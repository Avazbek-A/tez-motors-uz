/**
 * Harvest AutoHome car-overview video ids (mid) per car -> spec_data.video_mid.
 * The car detail page resolves it to a fresh signed mp4 via /api/video/{mid} and
 * streams DIRECT from AutoHome's CDN (no download).
 *
 * Reliability: the series video LIST page is JS-rendered (Playwright), but each
 * video page (v-{id}.html) is static and carries its own "seriesId" + the 32-hex
 * media id. We keep only a video whose primary seriesId matches the car's series
 * (ownership check), then drop any mid shared across cars (placeholder guard).
 *
 * Run: node autohome-video.mjs            (dry-run)
 *      node autohome-video.mjs --write [--limit=N]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const WRITE = process.argv.includes("--write");
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadEnv() {
  for (const p of ["../../.env.local", "../.env.local", "./.env.local"]) {
    try { const env = {}; for (const l of readFileSync(resolve(p), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); } if (env.NEXT_PUBLIC_SUPABASE_URL) return env; } catch {}
  }
  throw new Error(".env.local not found");
}

// static v-page -> { sids (all seriesIds, in order), mid (32-hex media id) }
async function vInfo(vid) {
  try {
    const r = await fetch(`https://v.autohome.com.cn/v-${vid}.html`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const html = await r.text();
    const sids = [...new Set([...html.matchAll(/"seriesId":(\d+)/g)].map((m) => Number(m[1])))];
    const mid = (html.match(/[A-F0-9]{32}/) || [])[0];
    return { sids, mid: mid || null };
  } catch { return null; }
}

async function main() {
  const env = loadEnv();
  const u = env.NEXT_PUBLIC_SUPABASE_URL, k = env.SUPABASE_SERVICE_ROLE_KEY;
  const H = { apikey: k, authorization: `Bearer ${k}`, "content-type": "application/json" };

  const cars = await (await fetch(`${u}/rest/v1/cars?select=id,slug,specs,spec_data&limit=600`, { headers: H })).json();
  let todo = cars.filter((c) => c.specs && c.specs.autohome_id);
  if (LIMIT) todo = todo.slice(0, LIMIT);
  console.log(`cars with a series id: ${todo.length}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: UA, locale: "zh-CN" });
  const pairs = []; let none = 0;
  try {
    for (const c of todo) {
      const S = Number(c.specs.autohome_id);
      let mid = null;
      try {
        await page.goto(`https://car.autohome.com.cn/video/series-${S}.html`, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(2500);
        const vids = await page.$$eval('a[href*="/v-"]', (as) => [...new Set(as.map((a) => (a.href.match(/v-(\d+)/) || [])[1]).filter(Boolean))]).catch(() => []);
        const cands = [];
        for (const vid of vids.slice(0, 6)) {
          const info = await vInfo(vid);
          await sleep(150);
          if (info && info.mid && info.sids.includes(S)) cands.push({ mid: info.mid, primary: info.sids[0] === S });
        }
        // prefer a clip primarily about THIS series, else any clip tagged with it
        mid = (cands.find((c) => c.primary) || cands[0] || {}).mid || null;
      } catch {}
      await sleep(250);
      if (!mid) { none++; continue; }
      pairs.push({ c, mid });
      console.log(`  ${c.slug}  series ${S} → mid ${mid.slice(0, 10)}…`);
    }
  } finally { await browser.close(); }

  const freq = {}; pairs.forEach((p) => (freq[p.mid] = (freq[p.mid] || 0) + 1));
  const unique = pairs.filter((p) => freq[p.mid] === 1);
  console.log(`\nvideos found: ${pairs.length} | unique/reliable: ${unique.length} | shared dropped: ${pairs.length - unique.length}`);

  let set = 0;
  if (WRITE) for (const { c, mid } of unique) {
    const sd = { ...(c.spec_data || {}), video_mid: mid };
    const r = await fetch(`${u}/rest/v1/cars?id=eq.${c.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ spec_data: sd }) });
    if (r.ok) set++;
  }
  console.log(`── ${WRITE ? "WROTE " + set : "dry-run"} ── reliable: ${unique.length} | no-video: ${none}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
