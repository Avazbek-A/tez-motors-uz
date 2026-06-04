/**
 * Headless-browser media extractor service. Runs OFF Cloudflare Workers — on
 * your Vostro / any Node box — because heavy JS-rendered, anti-bot sites
 * (AutoHome CN, AliExpress) only reveal their gallery images after the page's
 * JavaScript runs. A Worker `fetch` gets a near-empty shell; a real browser
 * renders the gallery, then we hand the image URLs back to the app.
 *
 * The website's /api/admin/media/extract route calls this when EXTRACTOR_URL is
 * set (POST /extract { url } -> { candidates:[{url,type}] }), merges the result
 * with its own static parse, and the dealer picks which to re-host. When the app
 * runs self-hosted on the SAME box, set EXTRACTOR_URL=http://localhost:8789.
 *
 * Setup (on the box):
 *   cd deploy/collector && npm install && npx playwright install chromium
 *   export EXTRACTOR_SECRET="...optional shared secret..."   # match the app
 *   export EXTRACTOR_PORT=8789
 *   node extractor.mjs
 * Then in the app's env: EXTRACTOR_URL=http://localhost:8789  (+ EXTRACTOR_SECRET)
 */
import { createServer } from "node:http";
import { chromium } from "playwright";

const PORT = Number(process.env.EXTRACTOR_PORT || 8789);
const SECRET = process.env.EXTRACTOR_SECRET || "";
const NAV_TIMEOUT = 35_000;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

let browser;
async function getBrowser() {
  if (!browser || !browser.isConnected()) browser = await chromium.launch({ headless: true });
  return browser;
}

/** Render the page, scroll to trigger lazy-load, return real image URLs. */
async function extract(url) {
  const b = await getBrowser();
  const ctx = await b.newContext({ userAgent: UA, viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    // Trigger lazy-load: scroll the page in steps, then settle.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 800) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 250));
      }
    });
    await page.waitForTimeout(1500);
    const urls = await page.evaluate(() => {
      const out = new Set();
      const push = (u) => { if (u && /^https?:\/\//.test(u) && /\.(jpe?g|png|webp)(\?|$)/i.test(u)) out.add(u); };
      for (const img of Array.from(document.querySelectorAll("img"))) {
        push(img.currentSrc || img.src);
        push(img.getAttribute("data-src"));
        push(img.getAttribute("data-original"));
        const ss = img.getAttribute("srcset");
        if (ss) push(ss.split(",")[0]?.trim().split(/\s+/)[0]);
      }
      // og:image as a fallback
      const og = document.querySelector('meta[property="og:image"]');
      if (og) push(og.getAttribute("content"));
      return Array.from(out);
    });
    const JUNK = /sprite|favicon|\bicons?\b|logo|placeholder|blank[._-]|avatar|loading|1x1|spacer|pixel/i;
    return urls.filter((u) => !JUNK.test(u)).slice(0, 200).map((u) => ({ url: u, type: "image" }));
  } finally {
    await ctx.close();
  }
}

/**
 * Capture a (possibly obfuscated, JS-rendered) AutoHome CN config page for the
 * spec sheet: slice screenshots of the full parameter table (so a vision LLM can
 * read the values that font/pseudo-element tricks hide from the DOM text) + the
 * gallery image URLs. The app feeds the screenshots to llmVision.
 */
async function captureSpec(url) {
  const b = await getBrowser();
  const ctx = await b.newContext({ userAgent: UA, viewport: { width: 1400, height: 2000 } });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: NAV_TIMEOUT });
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 1000) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 200)); }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1200);
    const images = await page.evaluate(() => {
      const out = new Set();
      const push = (u) => { if (u && /^https?:\/\//.test(u) && /\.(jpe?g|png|webp)(\?|$)/i.test(u)) out.add(u); };
      for (const img of Array.from(document.querySelectorAll("img"))) { push(img.currentSrc || img.src); push(img.getAttribute("data-src")); push(img.getAttribute("data-original")); }
      return Array.from(out);
    });
    const JUNK = /sprite|favicon|\bicons?\b|logo|placeholder|blank[._-]|avatar|loading|1x1|spacer|pixel/i;
    const gallery = images.filter((u) => !JUNK.test(u)).slice(0, 12);

    const total = await page.evaluate(() => document.body.scrollHeight);
    const VH = 2000, MAX = 6;
    const screenshots = [];
    for (let i = 0, y = 0; y < total && i < MAX; i++, y += VH) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(200);
      const buf = await page.screenshot({ type: "jpeg", quality: 70 });
      screenshots.push("data:image/jpeg;base64," + buf.toString("base64"));
    }
    return { screenshots, images: gallery, title: await page.title() };
  } finally {
    await ctx.close();
  }
}

/** Render a page (URL) OR raw HTML (with its print CSS) to a styled A4 PDF —
 *  spec sheets pass a URL; admin-gated documents (Phase AF) pass `html` since the
 *  extractor can't authenticate to fetch them. */
async function renderPdf(url, html) {
  const b = await getBrowser();
  const ctx = await b.newContext({ userAgent: UA });
  const page = await ctx.newPage();
  try {
    if (html) await page.setContent(html, { waitUntil: "networkidle", timeout: NAV_TIMEOUT });
    else await page.goto(url, { waitUntil: "networkidle", timeout: NAV_TIMEOUT });
    await page.emulateMedia({ media: "print" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
    });
  } finally {
    await ctx.close();
  }
}

const server = createServer((req, res) => {
  const json = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
  if (req.method === "GET" && req.url === "/health") return json(200, { ok: true });
  const route = (req.url || "").split("?")[0];
  if (req.method !== "POST" || (route !== "/extract" && route !== "/render-pdf" && route !== "/spec")) return json(404, { error: "not found" });
  if (SECRET) {
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${SECRET}`) return json(401, { error: "unauthorized" });
  }
  let body = "";
  // /render-pdf may carry a full HTML document (Phase AF) → allow a larger body.
  const cap = route === "/render-pdf" ? 4_000_000 : 8000;
  req.on("data", (c) => { body += c; if (body.length > cap) req.destroy(); });
  req.on("end", async () => {
    let parsed;
    try { parsed = JSON.parse(body); } catch { return json(400, { error: "invalid json" }); }
    const url = parsed.url;
    const html = typeof parsed.html === "string" ? parsed.html : null;
    if (route === "/render-pdf") {
      if (!html && (!url || !/^https?:\/\//.test(url))) return json(400, { error: "url or html required" });
      try {
        const pdf = await renderPdf(url, html);
        res.writeHead(200, { "content-type": "application/pdf" });
        res.end(pdf);
      } catch (e) {
        console.error("render-pdf failed", e?.message || e);
        json(502, { error: "render failed" }); // app falls back to printable HTML
      }
      return;
    }
    if (!url || !/^https?:\/\//.test(url)) return json(400, { error: "valid url required" });
    if (route === "/spec") {
      try {
        json(200, await captureSpec(url));
      } catch (e) {
        console.error("spec capture failed", e?.message || e);
        json(200, { screenshots: [], images: [] }); // fail-open
      }
      return;
    }
    try {
      const candidates = await extract(url);
      json(200, { candidates });
    } catch (e) {
      console.error("extract failed", e?.message || e);
      json(200, { candidates: [] }); // fail-open: app falls back to static parse
    }
  });
});

server.listen(PORT, () => console.log(`extractor listening on :${PORT}`));
