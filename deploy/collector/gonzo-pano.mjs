/**
 * Harvest AutoHome 360° panorama ids from gonzo-motors.uz and attach them to our
 * matching cars (spec_data.pano_id). Gonzo embeds AutoHome's pano viewer
 * (https://pano.autohome.com.cn/car/pano/{id}) per car; our cars store the
 * specs.gonzo_name they were matched from — so we map gonzo_name -> pano_id and
 * set it on the car. The car detail page then iframes the pano (like Gonzo).
 *
 * Run: node gonzo-pano.mjs            (dry-run, report coverage)
 *      node gonzo-pano.mjs --write    (PATCH spec_data.pano_id)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WRITE = process.argv.includes("--write");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadEnv() {
  for (const p of ["../../.env.local", "../.env.local", "./.env.local"]) {
    try {
      const env = {};
      for (const l of readFileSync(resolve(p), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); }
      if (env.NEXT_PUBLIC_SUPABASE_URL) return env;
    } catch {}
  }
  throw new Error(".env.local not found");
}

const PANO_RE = /pano\.autohome\.com\.cn\/car\/pano\/(\d+)/g;
// 76351 is gonzo's site-wide placeholder pano (shown when a car has no real 360);
// it appears on dozens of pages and is never the page's own car -> ignore it.
const PLACEHOLDER = new Set(["76351"]);
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function panoForUrl(url) {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "ru,en" } });
    if (!r.ok) return null;
    const html = await r.text();
    const ids = [...html.matchAll(PANO_RE)].map((m) => m[1]).filter((id) => !PLACEHOLDER.has(id));
    return ids[0] || null;            // first real (non-placeholder) pano = the car's own
  } catch { return null; }
}

async function main() {
  const env = loadEnv();
  const u = env.NEXT_PUBLIC_SUPABASE_URL, k = env.SUPABASE_SERVICE_ROLE_KEY;
  const H = { apikey: k, authorization: `Bearer ${k}`, "content-type": "application/json" };

  // gonzo discovery: name -> url
  const disc = JSON.parse(readFileSync(resolve("./gonzo-discovery.json"), "utf8")).cars || [];
  const urlByName = new Map(disc.map((c) => [norm(c.name), c.url]).filter(([, v]) => v));

  // our cars with a gonzo_name
  const cars = await (await fetch(`${u}/rest/v1/cars?select=id,slug,specs,spec_data&limit=600`, { headers: H })).json();
  const targets = cars.filter((c) => c.specs && c.specs.gonzo_name);
  console.log(`cars with gonzo_name: ${targets.length} / ${cars.length}`);

  // PASS 1 — collect (car -> pano) without writing
  const pairs = []; let miss = 0, nourl = 0;
  for (const c of targets) {
    const gurl = urlByName.get(norm(c.specs.gonzo_name));
    if (!gurl) { nourl++; continue; }
    const pano = await panoForUrl(gurl);
    await sleep(150);
    if (!pano) { miss++; continue; }
    pairs.push({ c, pano });
  }
  // a real per-car pano is UNIQUE; a pano shared across cars is a gonzo template
  // fallback (wrong car) -> drop it.
  const freq = {}; pairs.forEach((p) => (freq[p.pano] = (freq[p.pano] || 0) + 1));
  const unique = pairs.filter((p) => freq[p.pano] === 1);
  const shared = [...new Set(pairs.filter((p) => freq[p.pano] > 1).map((p) => p.pano))];
  console.log(`pano refs found: ${pairs.length} | UNIQUE (reliable): ${unique.length} | shared/placeholder dropped: ${pairs.length - unique.length} (${shared.length} ids: ${shared.join(",")})`);

  // PASS 2 — write the unique ones
  let set = 0;
  for (const { c, pano } of unique) {
    if (WRITE) {
      const sd = { ...(c.spec_data || {}), pano_id: pano };
      const r = await fetch(`${u}/rest/v1/cars?id=eq.${c.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ spec_data: sd }) });
      if (r.ok) { set++; if (set % 25 === 0) console.log(`  …${set} set`); }
    } else if (set < 12) { console.log(`  ${c.slug}  ←  ${c.specs.gonzo_name}  →  pano ${pano}`); set++; }
  }
  console.log(`\n── ${WRITE ? "WROTE " + set : "dry-run"} ── reliable panos: ${unique.length} | no-pano-on-gonzo: ${miss} | no-gonzo-url: ${nourl}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
