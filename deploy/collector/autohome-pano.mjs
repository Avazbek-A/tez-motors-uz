/**
 * Get AutoHome 360° pano ids DIRECTLY from AutoHome (for cars gonzo has no 360 for).
 * The series overview page www.autohome.com.cn/{seriesId}/ links to the pano:
 *   https://pano.autohome.com.cn/car/ext/{panoId}
 * We render it (it's JS-built), extract the pano id, and set spec_data.pano_id.
 * The car detail page then iframes pano.autohome.com.cn/car/pano/{panoId}.
 *
 * Run: node autohome-pano.mjs            (dry-run)
 *      node autohome-pano.mjs --write    (PATCH spec_data.pano_id)
 *      node autohome-pano.mjs --write --limit=40
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const WRITE = process.argv.includes("--write");
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PANO_RE = /pano\.autohome\.com\.cn\/car\/(?:ext|pano)\/(\d+)/;

function loadEnv() {
  for (const p of ["../../.env.local", "../.env.local", "./.env.local"]) {
    try { const env = {}; for (const l of readFileSync(resolve(p), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); } if (env.NEXT_PUBLIC_SUPABASE_URL) return env; } catch {}
  }
  throw new Error(".env.local not found");
}

async function panoForSeries(page, seriesId) {
  try {
    await page.goto(`https://www.autohome.com.cn/${seriesId}/`, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const html = await page.content();
    const m = html.match(PANO_RE);
    return m ? m[1] : null;
  } catch { return null; }
}

async function main() {
  const env = loadEnv();
  const u = env.NEXT_PUBLIC_SUPABASE_URL, k = env.SUPABASE_SERVICE_ROLE_KEY;
  const H = { apikey: k, authorization: `Bearer ${k}`, "content-type": "application/json" };

  const cars = await (await fetch(`${u}/rest/v1/cars?select=id,slug,specs,spec_data&limit=600`, { headers: H })).json();
  let todo = cars.filter((c) => c.specs && c.specs.autohome_id && !(c.spec_data && c.spec_data.pano_id));
  if (LIMIT) todo = todo.slice(0, LIMIT);
  console.log(`cars needing a pano (have series id, no pano yet): ${todo.length}\n`);

  // existing pano ids already on OTHER cars — a freshly-found pano matching one of
  // these is a shared/featured placeholder (the series has no own 360), not real.
  const existing = {}; cars.forEach((c) => { const p = c.spec_data?.pano_id; if (p) existing[p] = (existing[p] || 0) + 1; });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: UA, locale: "zh-CN" });
  // PASS 1 — collect (no write)
  const pairs = []; let none = 0;
  try {
    for (const c of todo) {
      const pano = await panoForSeries(page, c.specs.autohome_id);
      await sleep(400);
      if (!pano) { none++; continue; }
      pairs.push({ c, pano });
      console.log(`  ${c.slug}  series ${c.specs.autohome_id} → pano ${pano}`);
    }
  } finally { await browser.close(); }
  // a real per-series pano is UNIQUE — drop ones repeated within this run OR already used elsewhere
  const freq = {}; pairs.forEach((p) => (freq[p.pano] = (freq[p.pano] || 0) + 1));
  const unique = pairs.filter((p) => freq[p.pano] === 1 && !existing[p.pano]);
  const dropped = pairs.length - unique.length;
  console.log(`\npano found: ${pairs.length} | unique/reliable: ${unique.length} | shared/placeholder dropped: ${dropped}`);
  // PASS 2 — write uniques
  let set = 0;
  if (WRITE) for (const { c, pano } of unique) {
    const sd = { ...(c.spec_data || {}), pano_id: pano };
    const r = await fetch(`${u}/rest/v1/cars?id=eq.${c.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ spec_data: sd }) });
    if (r.ok) set++;
  }
  console.log(`── ${WRITE ? "WROTE " + set : "dry-run"} ── reliable: ${unique.length} | no-pano: ${none}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
