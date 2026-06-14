/**
 * Generate the OLX/avtoelon search list from the LIVE cars catalog, so market
 * price coverage automatically tracks what the dealer actually stocks/imports
 * (instead of a hard-coded handful). Writes searches.json in the collector's
 * search format: [{ q, brand, model }]. Re-run whenever the catalog changes.
 *
 * Run (on the box, reads .env.local for Supabase):
 *   node gen-searches.mjs            → writes ./searches.json
 *   OLX_SEARCHES_FILE=./searches.json node olx-crawlee.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  for (const p of ["../../.env.local", "../.env.local", "./.env.local", "/home/rayxona/tez-motors/.env.local"]) {
    try { const e = {}; for (const l of readFileSync(resolve(p), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) e[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); } if (e.NEXT_PUBLIC_SUPABASE_URL) return e; } catch {}
  }
  return {};
}

const OUT = process.env.SEARCHES_OUT || "searches.json";

async function main() {
  const env = loadEnv();
  const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!U || !K) { console.error("FATAL: missing Supabase env"); process.exit(1); }
  const H = { apikey: K, authorization: `Bearer ${K}` };

  const cars = await (await fetch(`${U}/rest/v1/cars?select=brand,model&limit=400`, { headers: H })).json();
  const seen = new Set(), out = [];
  for (const c of cars) {
    const brand = String(c.brand || "").trim(), model = String(c.model || "").trim();
    if (!brand || !model) continue;
    const q = `${brand} ${model}`.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(q)) continue;
    seen.add(q);
    out.push({ q, brand, model });
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`wrote ${OUT}: ${out.length} unique brand+model searches (from ${cars.length} cars)`);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
