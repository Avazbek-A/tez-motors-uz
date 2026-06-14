/**
 * One-shot data cleanup for the colors feature (no AutoHome re-scrape):
 *  1. Re-translate every exterior + interior colour name with the improved
 *     cn-color-dict (fixes 青/沙/干邑/栗/Italian names that fell back to CN).
 *  2. Clear interior_colors[].images — AutoHome's per-interior-colour galleries
 *     are JS-rendered, so the scraped interior photos were wrong (exterior shots
 *     bled in). Keep the interior swatch (name + hex), drop the bad photos.
 * Exterior galleries are correct and left untouched.
 *
 * Run:  node colors-cleanup.mjs          (dry — report)
 *       node colors-cleanup.mjs --write  (PATCH spec_data)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { translateColor } from "./cn-color-dict.mjs";

const WRITE = process.argv.includes("--write");

function loadEnv() {
  for (const p of ["../../.env.local", "../.env.local", "./.env.local", "/home/rayxona/tez-motors/.env.local"]) {
    try { const e = {}; for (const l of readFileSync(resolve(p), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) e[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); } if (e.NEXT_PUBLIC_SUPABASE_URL) return e; } catch {}
  }
  return {};
}

function retranslate(col) {
  if (!col?.name_cn) return col;
  return { ...col, ...translateColor(col.name_cn) };
}

async function main() {
  const env = loadEnv();
  const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!U || !K) { console.error("FATAL: missing Supabase env"); process.exit(1); }
  const H = { apikey: K, authorization: `Bearer ${K}`, "content-type": "application/json" };

  const cars = await (await fetch(`${U}/rest/v1/cars?select=id,slug,spec_data&limit=400`, { headers: H })).json();
  let touched = 0, intCleared = 0, renamed = 0, wrote = 0;

  for (const c of cars) {
    const sd = c.spec_data;
    if (!sd || (!sd.exterior_colors?.length && !sd.interior_colors?.length)) continue;
    let changed = false;

    if (Array.isArray(sd.exterior_colors)) {
      sd.exterior_colors = sd.exterior_colors.map((col) => {
        const t = retranslate(col);
        if (t.name_ru !== col.name_ru) renamed++;
        if (t.name_ru !== col.name_ru || t.name_en !== col.name_en) changed = true;
        return t;
      });
    }
    if (Array.isArray(sd.interior_colors)) {
      sd.interior_colors = sd.interior_colors.map((col) => {
        const t = retranslate(col);
        if (t.name_ru !== col.name_ru) renamed++;
        if ((col.images?.length || 0) > 0) { intCleared++; changed = true; }
        return { ...t, images: [] }; // drop the wrong interior photos
      });
    }
    if (!changed) continue;
    touched++;
    console.log(`  ${c.slug}: ext=${sd.exterior_colors?.length || 0} int=${sd.interior_colors?.length || 0} (cleared interior photos${sd.interior_colors?.length ? "" : " n/a"})`);

    if (WRITE) {
      const r = await fetch(`${U}/rest/v1/cars?id=eq.${c.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ spec_data: sd }) });
      if (r.ok) wrote++; else console.log(`     PATCH ${r.status} ${await r.text()}`);
    }
  }
  console.log(`\n── cars touched ${touched} | colours renamed ${renamed} | interior sets cleared ${intCleared} | wrote ${wrote} ──`);
  if (!WRITE) console.log("(dry — re-run with --write to PATCH)");
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
