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

// Mirror of src/lib/model-normalize.ts: strip chassis codes "(g60)", embedded
// years, and engine/fuel/drivetrain tokens — so the search query is the clean
// base name ("bmw 5 series" not "bmw 5 series (g60) 2025"). KEEPS Plus/Pro/Max.
const MODEL_NOISE = /^(\d(?:\.\d)?[tl]|hev|phev|mhev|dm-?i|dmi|ev|bev|awd|4wd|2wd|fwd|rwd)$/i;
const normModel = (m) =>
  String(m || "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(/\b(19|20)\d{2}\b/g, " ")
    .split(/[\s/,]+/).map((t) => t.trim()).filter((t) => t && !MODEL_NOISE.test(t)).join(" ").trim();

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
    // Search the CLEAN base name (better marketplace hit rate); store the exact
    // catalog model so results still join to the catalog. Trim variants that
    // collapse to the same query are deduped — the buy brain's base-model fallback
    // still credits each variant with these comps.
    const cleanModel = normModel(model) || model.toLowerCase();
    const q = `${brand} ${cleanModel}`.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(q)) continue;
    seen.add(q);
    out.push({ q, brand, model });
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`wrote ${OUT}: ${out.length} unique brand+model searches (from ${cars.length} cars)`);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
