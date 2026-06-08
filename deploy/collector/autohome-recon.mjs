/**
 * AutoHome CN recon — Phase AUTOHOME, stage 0 (RUN THIS FIRST, on the Vostro).
 *
 * AutoHome's domestic anti-scrape scheme (which embedded JSON blobs carry the
 * config, which custom FONT obfuscates the numbers, whether the cheap server-HTML
 * GET even contains the data) DRIFTS over time and CANNOT be pinned down from
 * memory — it has to be observed against a LIVE page. This script does exactly
 * that and prints a verdict on which extraction layers are viable, so the real
 * decoder (Layers 1–2 in autohome-extract.mjs) is built against real bytes, not
 * guesses.
 *
 * It is a READ-ONLY diagnostic: it fetches one config page two ways (a plain
 * server GET = the cheap Layer-1/2 footprint, and a full Playwright render = the
 * Layer-3 fallback), then dumps artifacts you can inspect or paste back:
 *   recon-out/<id>/raw.html         server HTML (no JS)        ← Layer-1 viability
 *   recon-out/<id>/rendered.html    DOM after JS               ← what the browser sees
 *   recon-out/<id>/page.jpg         full-page screenshot       ← Layer-3 vision input
 *   recon-out/<id>/font-*.{woff2…}  every @font-face file      ← Layer-2 decode target
 *   recon-out/<id>/summary.json     machine-readable findings  ← paste this back
 *
 * Usage (on the box, Node 18+, after `npm install && npx playwright install chromium`):
 *   node autohome-recon.mjs "https://car.autohome.com.cn/config/series/5769.html"
 *   node autohome-recon.mjs "<spec-or-series-config-url>" ./my-out-dir
 *
 * No proxy needed for one page from a residential IP; if even this gets a captcha
 * wall, that itself is the finding (set PROXY_URLS and re-run — see crawlee-shared).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const URL_ARG = process.argv[2];
const OUT_ROOT = process.argv[3] || "./recon-out";

if (!URL_ARG || !/^https?:\/\//.test(URL_ARG)) {
  console.error("Usage: node autohome-recon.mjs <autohome-config-url> [outDir]");
  console.error('  e.g. node autohome-recon.mjs "https://car.autohome.com.cn/config/series/5769.html"');
  process.exit(1);
}

const pageId = (() => {
  try {
    const u = new URL(URL_ARG);
    return (u.pathname.replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "") || "page").slice(0, 60);
  } catch {
    return "page";
  }
})();
const OUT = join(OUT_ROOT, pageId);
mkdirSync(OUT, { recursive: true });

const ORIGIN = (() => { try { return new URL(URL_ARG).origin; } catch { return ""; } })();
const HEADERS = {
  "user-agent": UA,
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
  referer: ORIGIN ? `${ORIGIN}/` : URL_ARG,
};

// --- known AutoHome markers we hope to find in an embedded JSON/JS blob ---
const CONFIG_MARKERS = [
  "JsonConfig", "JsonOption", "JsonColor", "JsonInnerColor", "JsonPantograph",
  "config", "option", "bag", "specitems", "paramtypeitems", "speclist",
  "paramtypename", "configTypeName", "__NUXT__", "__INITIAL_STATE__", "__NEXT_DATA__",
  // Chinese section/param markers — present even when var names are minified.
  "基本参数", "车身", "发动机", "电动机", "变速箱", "底盘", "车型名称", "厂商指导价",
];

/** Pull every inline <script> body and report the ones that look like data blobs. */
function findScriptBlobs(html) {
  const blobs = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || "";
    const body = m[2] || "";
    if (/\bsrc=/.test(attrs)) continue; // external; no inline payload
    if (body.length < 200) continue;
    const vars = [
      ...body.matchAll(/(?:var|let|const|window\.)\s*([A-Za-z_$][\w$]*)\s*=/g),
    ].map((x) => x[1]);
    const markers = CONFIG_MARKERS.filter((k) => body.includes(k));
    if (vars.length || markers.length) {
      blobs.push({
        length: body.length,
        vars: [...new Set(vars)].slice(0, 25),
        markers,
        snippet: body.replace(/\s+/g, " ").slice(0, 280),
      });
    }
  }
  // Biggest blobs first — the config is usually the largest inline script.
  return blobs.sort((a, b) => b.length - a.length).slice(0, 8);
}

/** Extract @font-face rules (family + every url()/data: src) from HTML/CSS text. */
function extractFontFaces(text) {
  const out = [];
  const re = /@font-face\s*\{([^}]*)\}/gi;
  let m;
  while ((m = re.exec(text))) {
    const block = m[1];
    const family = (block.match(/font-family\s*:\s*([^;]+);?/i) || [])[1]?.trim().replace(/['"]/g, "");
    const urls = [...block.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)].map((x) => x[1]);
    out.push({
      family,
      httpSrcs: urls.filter((u) => /^https?:|^\/\//.test(u)),
      dataSrcs: urls.filter((u) => /^data:/.test(u)),
    });
  }
  return out;
}

/** Any bare font URL anywhere (some pages inject fonts via JS, not @font-face). */
function findFontUrls(text) {
  return [...new Set(
    [...text.matchAll(/https?:\/\/[^"'\s)]+\.(?:woff2|woff|ttf|otf)(?:\?[^"'\s)]*)?/gi)].map((x) => x[0]),
  )];
}

function sniffFont(bytes) {
  if (bytes.length < 4) return "unknown";
  const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (sig === "wOF2") return "woff2";
  if (sig === "wOFF") return "woff";
  if (sig === "OTTO") return "otf";
  if (bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) return "ttf";
  if (sig === "true" || sig === "ttcf") return "ttf";
  return "unknown";
}

async function downloadFont(url, idx) {
  const abs = url.startsWith("//") ? "https:" + url : url;
  try {
    const r = await fetch(abs, { headers: { ...HEADERS, accept: "*/*" }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return { url: abs, ok: false, status: r.status };
    const bytes = new Uint8Array(await r.arrayBuffer());
    const fmt = sniffFont(bytes);
    const file = join(OUT, `font-${idx}.${fmt === "unknown" ? "bin" : fmt}`);
    writeFileSync(file, bytes);
    return { url: abs, ok: true, bytes: bytes.byteLength, format: fmt, file };
  } catch (e) {
    return { url: abs, ok: false, error: e?.message || String(e) };
  }
}

function looksBlocked(htmlOrTitle) {
  return /(验证|滑动|安全验证|captcha|robot|访问验证|forbidden|拒绝访问)/i.test(htmlOrTitle || "");
}

const summary = {
  url: URL_ARG,
  capturedAt: new Date().toISOString(),
  raw: {}, rendered: {}, fonts: [], puaSamples: [], customFonts: [], verdict: {},
};

async function main() {
  console.log(`\n=== AutoHome recon → ${URL_ARG} ===`);
  console.log(`out: ${OUT}\n`);

  // --- 1) Cheap server GET (the Layer-1/2 footprint) ---
  let rawHtml = "";
  try {
    const r = await fetch(URL_ARG, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
    rawHtml = await r.text();
    writeFileSync(join(OUT, "raw.html"), rawHtml);
    const blobs = findScriptBlobs(rawHtml);
    const faces = extractFontFaces(rawHtml);
    summary.raw = {
      status: r.status,
      bytes: rawHtml.length,
      blocked: looksBlocked(rawHtml),
      markersInRaw: CONFIG_MARKERS.filter((k) => rawHtml.includes(k)),
      scriptBlobs: blobs,
      fontFaces: faces,
      bareFontUrls: findFontUrls(rawHtml),
    };
    console.log(`[1] server GET  : ${r.status}, ${rawHtml.length} bytes${summary.raw.blocked ? "  ⚠ LOOKS BLOCKED" : ""}`);
    console.log(`    config markers in raw HTML: ${summary.raw.markersInRaw.join(", ") || "(none — data is JS-rendered)"}`);
    console.log(`    inline data blobs: ${blobs.length} (largest ${blobs[0]?.length || 0} bytes, markers: ${blobs[0]?.markers?.join("/") || "—"})`);
    console.log(`    @font-face: ${faces.length}; bare font URLs: ${summary.raw.bareFontUrls.length}`);
  } catch (e) {
    summary.raw = { error: e?.message || String(e) };
    console.log(`[1] server GET  : FAILED — ${summary.raw.error}`);
  }

  // --- 2) Full Playwright render (the Layer-3 footprint) ---
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 2200 }, locale: "zh-CN" });
    const page = await ctx.newPage();
    await page.goto(URL_ARG, { waitUntil: "networkidle", timeout: 45000 });
    // settle lazy content
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 1000) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)); }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1200);

    const title = await page.title();
    const renderedHtml = await page.content();
    writeFileSync(join(OUT, "rendered.html"), renderedHtml);
    await page.screenshot({ path: join(OUT, "page.jpg"), type: "jpeg", quality: 70, fullPage: true });

    // Loaded fonts (FontFaceSet) + which families the live DOM actually paints with.
    const fontInfo = await page.evaluate(() => {
      const loaded = [];
      try { document.fonts.forEach((f) => loaded.push({ family: f.family, status: f.status })); } catch { /* noop */ }
      const families = new Set();
      for (const el of Array.from(document.querySelectorAll("body *")).slice(0, 6000)) {
        const ff = getComputedStyle(el).fontFamily || "";
        // AutoHome's obfuscation font-family is non-standard (random/minified name).
        if (ff && !/^(?:inherit|initial|\s*(?:-apple-system|system-ui|arial|helvetica|"?microsoft yahei"?|"?pingfang|"?simsun|sans-serif|tahoma|roboto|"?segoe)[^,]*)/i.test(ff)) {
          families.add(ff);
        }
      }
      return { loaded, customFamilies: [...families].slice(0, 40) };
    });

    // Private-Use-Area glyphs = the smoking gun that numbers are font-mapped.
    const pua = await page.evaluate(() => {
      const hits = [];
      const isPua = (cp) => (cp >= 0xe000 && cp <= 0xf8ff) || (cp >= 0xf0000 && cp <= 0xffffd);
      for (const el of Array.from(document.querySelectorAll("body *"))) {
        if (el.children.length !== 0) continue;
        const t = (el.textContent || "").trim();
        if (!t || t.length > 40) continue;
        for (const ch of t) {
          if (isPua(ch.codePointAt(0))) {
            hits.push({ text: t, codepointsHex: [...t].map((c) => c.codePointAt(0).toString(16)).join(" "), font: getComputedStyle(el).fontFamily });
            break;
          }
        }
        if (hits.length >= 25) break;
      }
      return hits;
    });

    const blobs = findScriptBlobs(renderedHtml);
    const faces = extractFontFaces(renderedHtml);
    summary.rendered = {
      title,
      blocked: looksBlocked(title) || looksBlocked(renderedHtml),
      bytes: renderedHtml.length,
      markersInRendered: CONFIG_MARKERS.filter((k) => renderedHtml.includes(k)),
      scriptBlobs: blobs,
      fontFaces: faces,
      bareFontUrls: findFontUrls(renderedHtml),
      loadedFonts: fontInfo.loaded,
    };
    summary.customFonts = fontInfo.customFamilies;
    summary.puaSamples = pua;

    console.log(`[2] render      : "${title}"${summary.rendered.blocked ? "  ⚠ LOOKS BLOCKED" : ""}, ${renderedHtml.length} bytes`);
    console.log(`    custom font-families painted: ${fontInfo.customFamilies.length ? fontInfo.customFamilies.join(" | ") : "(none obvious)"}`);
    console.log(`    PUA-glyph text samples (font-mapped numbers?): ${pua.length}`);
    if (pua.length) console.log(`      e.g. "${pua[0].text}"  [${pua[0].codepointsHex}]  font=${pua[0].font}`);

    await ctx.close();
  } catch (e) {
    summary.rendered = { error: e?.message || String(e) };
    console.log(`[2] render      : FAILED — ${summary.rendered.error}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  // --- 3) Download every font we found (the Layer-2 decode target) ---
  const fontUrls = [...new Set([
    ...(summary.raw.bareFontUrls || []),
    ...(summary.rendered?.bareFontUrls || []),
    ...((summary.raw.fontFaces || []).flatMap((f) => f.httpSrcs || [])),
    ...((summary.rendered?.fontFaces || []).flatMap((f) => f.httpSrcs || [])),
  ])];
  console.log(`\n[3] fonts        : downloading ${fontUrls.length} candidate(s)…`);
  for (let i = 0; i < fontUrls.length && i < 12; i++) {
    const res = await downloadFont(fontUrls[i], i);
    summary.fonts.push(res);
    console.log(`    ${res.ok ? "✓" : "✗"} ${res.format || res.status || res.error || ""}  ${res.bytes ? res.bytes + "b" : ""}  ${fontUrls[i].slice(0, 90)}`);
  }
  // Note any inline data: fonts (no download needed — they're in the HTML already).
  const dataFontCount =
    (summary.raw.fontFaces || []).filter((f) => (f.dataSrcs || []).length).length +
    (summary.rendered?.fontFaces || []).filter((f) => (f.dataSrcs || []).length).length;
  if (dataFontCount) console.log(`    + ${dataFontCount} inline data: font(s) embedded in HTML (see raw/rendered.html)`);

  // --- 4) Verdict: which layers are viable right now? ---
  const rawHasData = (summary.raw.markersInRaw || []).length >= 2 || (summary.raw.scriptBlobs || []).some((b) => b.markers.length);
  const renderedHasData = (summary.rendered?.markersInRendered || []).length >= 2 || (summary.rendered?.scriptBlobs || []).some((b) => b.markers?.length);
  const fontObfuscation = summary.puaSamples.length > 0 || summary.customFonts.length > 0 || dataFontCount > 0 || summary.fonts.some((f) => f.ok);
  const blocked = summary.raw.blocked || summary.rendered?.blocked;

  summary.verdict = {
    blocked: !!blocked,
    layer1_cheapGetHasConfig: !!rawHasData,
    layer1_renderHasConfig: !!renderedHasData,
    layer2_fontObfuscationPresent: !!fontObfuscation,
    layer3_visionNeeded: !rawHasData && !renderedHasData,
  };

  console.log(`\n=== VERDICT ===`);
  if (blocked) console.log(`⚠ BLOCKED — even recon hit a wall. Set PROXY_URLS (residential) and re-run before trusting any layer.`);
  console.log(`Layer 1 (embedded JSON via cheap GET)  : ${rawHasData ? "VIABLE — config is in server HTML, no browser needed" : renderedHasData ? "needs render (data only after JS)" : "NOT FOUND"}`);
  console.log(`Layer 2 (font de-obfuscation)          : ${fontObfuscation ? "REQUIRED — font-mapped values detected; decode the saved font-*.* file(s)" : "maybe unnecessary — no obvious font obfuscation seen"}`);
  console.log(`Layer 3 (screenshot → vision fallback) : ${summary.verdict.layer3_visionNeeded ? "this page would FALL THROUGH to vision (no embedded data parsed)" : "fallback only — embedded data should win first"}`);
  console.log(`\nArtifacts written to: ${OUT}`);
  console.log(`Paste back: summary.json (+ the largest scriptBlob snippet & one font-*.* filename) so the decoder is built against real bytes.\n`);

  writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
}

main().catch((e) => { console.error(e?.stack || String(e)); process.exit(1); });
