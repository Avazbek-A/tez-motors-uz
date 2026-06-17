/**
 * Source a product photo for each DRAFT part from a SUPPLIER catalogue
 * (AliExpress) — keyed on the part's English name + car model — and rehost it to
 * our media disk. Never uses Gonzo's images. Best-effort: a part with no good
 * supplier match is simply left photo-less (stays an unpublishable draft).
 *
 * Run enrich-parts.mjs FIRST (it writes name_en, which is the search query).
 *
 *   node source-part-images.mjs --limit 5      (try 5 parts — validate quality)
 *   node source-part-images.mjs --write        (source + attach for all photo-less drafts)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WRITE = process.argv.includes("--write");
const LIMIT = (() => { const i = process.argv.indexOf("--limit"); return i > 0 ? Number(process.argv[i + 1]) : Infinity; })();
const NM = "/home/rayxona/tez-motors/deploy/collector/node_modules";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function loadEnv() {
  for (const p of ["../../.env.local", "../.env.local", "./.env.local", "/home/rayxona/tez-motors/.env.local"]) {
    try { const e = {}; for (const l of readFileSync(resolve(p), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) e[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); } if (e.NEXT_PUBLIC_SUPABASE_URL) return e; } catch {}
  }
  return {};
}
const env = loadEnv();
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, authorization: `Bearer ${K}`, "content-type": "application/json" };
const MEDIA_URL = env.SELFHOST_URL || "http://127.0.0.1:3000";
const MEDIA_SECRET = env.MEDIA_UPLOAD_SECRET || "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sniff(b) {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57) return "image/webp";
  return null;
}
async function rehost(url) {
  const r = await fetch(url.startsWith("//") ? "https:" + url : url, { headers: { "user-agent": UA, accept: "image/*" }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`img ${r.status}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.byteLength < 6000 || bytes.byteLength > 12 * 1024 * 1024) throw new Error("size");
  const mime = sniff(bytes); if (!mime) throw new Error("not image");
  const up = await fetch(`${MEDIA_URL}/api/admin/disk-image?bucket=part-images&dir=supplier`, {
    method: "POST", headers: { "content-type": mime, authorization: `Bearer ${MEDIA_SECRET}` }, body: bytes, signal: AbortSignal.timeout(30000),
  });
  if (!up.ok) throw new Error(`disk ${up.status}`);
  const j = await up.json(); if (!j.url) throw new Error("disk no url");
  return j.url;
}

async function main() {
  if (!MEDIA_SECRET) { console.error("FATAL: MEDIA_UPLOAD_SECRET unset"); process.exit(1); }
  const { chromium } = await import(`${NM}/playwright/index.mjs`);
  const parts = await (await fetch(`${U}/rest/v1/parts?select=id,name_ru,name_en,brand,fits_models,images&is_published=eq.false&limit=5000`, { headers: H })).json();
  const todo = parts.filter((p) => !(Array.isArray(p.images) && p.images.length)).slice(0, LIMIT);
  console.log(`photo-less drafts: ${todo.length}`);

  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ locale: "ru-RU", userAgent: UA });
  const page = await ctx.newPage();
  let attached = 0, missed = 0;
  for (const p of todo) {
    const q = (p.name_en || `${p.brand || ""} ${(p.fits_models || [])[0] || ""} ${p.name_ru}`).trim();
    try {
      // AliExpress blocks the Vostro IP with a captcha, so we discover the SAME
      // supplier product photos via Bing image search, preferring supplier CDNs
      // (alicdn/alibaba/made-in-china/…). Each candidate is size+type validated by
      // rehost(); we fall through on any that 403/aren't a real image.
      await page.goto(`https://www.bing.com/images/search?q=${encodeURIComponent(q + " запчасть")}&qft=+filterui:photo-photo+filterui:imagesize-large`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await sleep(2200);
      const cands = await page.evaluate(() => {
        const out = [];
        for (const a of document.querySelectorAll("a.iusc")) {
          const m = a.getAttribute("m"); if (!m) continue;
          try { const j = JSON.parse(m); if (j.murl && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(j.murl)) out.push(j.murl); } catch {}
        }
        return out.slice(0, 30);
      });
      const SUP = /(alicdn|aliexpress|alibaba|made-in-china|1688|dhgate|globalsources|aliimg|joom|autodoc|emex|exist)\./i;
      const ordered = [...cands.filter((u) => SUP.test(u)), ...cands.filter((u) => !SUP.test(u))];
      let url = null;
      for (const cand of ordered) { try { url = await rehost(cand); break; } catch { /* next */ } }
      if (!url) { missed++; console.log(`  ✗ ${q.slice(0, 45)} — no usable image`); continue; }
      if (WRITE) { const rr = await fetch(`${U}/rest/v1/parts?id=eq.${p.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ images: [url] }) }); if (rr.ok) attached++; }
      else attached++;
      console.log(`  ✓ ${q.slice(0, 45)} → ${url.split("/").pop()}`);
    } catch (e) { missed++; console.log(`  ✗ ${q.slice(0, 45)} — ${String(e.message || e).slice(0, 40)}`); }
    await sleep(1200);
  }
  await b.close();
  console.log(`\n${WRITE ? "attached" : "(dry) would attach"} ${attached}, missed ${missed}`);
}
main().catch((e) => { console.error(e?.stack || String(e)); process.exit(1); });
