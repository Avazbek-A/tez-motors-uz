/**
 * Delete obvious junk from the DRAFT parts (is_published=false) using the same
 * deterministic filter as the ingester — car-for-sale ads, mis-priced noise, and
 * titles with no part term. Only touches drafts; published/reviewed parts are safe.
 *
 * Run (dry):   node clean-parts.mjs
 * Run (write): node clean-parts.mjs --write
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isJunkPart } from "./parts-quality.mjs";

const WRITE = process.argv.includes("--write");
function loadEnv() {
  for (const p of ["../../.env.local", "../.env.local", "./.env.local", "/home/rayxona/tez-motors/.env.local"]) {
    try { const e = {}; for (const l of readFileSync(resolve(p), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) e[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); } if (e.NEXT_PUBLIC_SUPABASE_URL) return e; } catch {}
  }
  return {};
}
const env = loadEnv();
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, authorization: `Bearer ${K}`, "content-type": "application/json" };

async function main() {
  const rows = await (await fetch(`${U}/rest/v1/parts?select=id,name_ru,price_usd&is_published=eq.false&limit=5000`, { headers: H })).json();
  const junk = rows.filter((r) => isJunkPart(r.name_ru, r.price_usd));
  console.log(`draft parts: ${rows.length} | junk to remove: ${junk.length} | clean keep: ${rows.length - junk.length}`);
  console.log("sample junk:", junk.slice(0, 6).map((r) => `${(r.name_ru || "").slice(0, 36)} ($${r.price_usd})`));
  if (!WRITE) { console.log("(dry-run; pass --write to delete)"); return; }
  let deleted = 0;
  for (let i = 0; i < junk.length; i += 50) {
    const ids = junk.slice(i, i + 50).map((r) => r.id);
    const res = await fetch(`${U}/rest/v1/parts?id=in.(${ids.join(",")})&is_published=eq.false`, { method: "DELETE", headers: { ...H, Prefer: "return=minimal" } });
    if (res.ok) deleted += ids.length; else console.log(`del batch ${i} FAIL ${res.status}`);
  }
  console.log(`deleted ${deleted} junk drafts.`);
}
main().catch((e) => { console.error(e?.stack || String(e)); process.exit(1); });
