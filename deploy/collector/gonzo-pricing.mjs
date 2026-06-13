/**
 * Populate cars.price_usd from Gonzo's CIP-Tashkent prices, MINUS $100.
 * Gonzo's catalog card price == the CIP-Tashkent starting price (verified), so we
 * read gonzo-discovery.json directly — no per-car scrape. Match tez cars ↔ Gonzo by
 * normalized brand+model. Matched → price_usd = gonzoCip - 100. Unmatched / no-price
 * are reported for the deduction pass (not written here).
 *
 * Run:  node gonzo-pricing.mjs            (dry — match report)
 *       node gonzo-pricing.mjs --write    (PATCH matched prices)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WRITE = process.argv.includes("--write");
const DELTA = 100; // $ cheaper than Gonzo

function loadEnv() {
  for (const p of ["../../.env.local", "../.env.local", "/home/rayxona/tez-motors/.env.local"]) {
    try { const e = {}; for (const l of readFileSync(resolve(p), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) e[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); } if (e.NEXT_PUBLIC_SUPABASE_URL) return e; } catch {}
  }
  return {};
}
function readGonzo() {
  for (const p of ["./gonzo-discovery.json", "../collector/gonzo-discovery.json", "/home/rayxona/tez-motors/deploy/collector/gonzo-discovery.json"]) {
    try { const d = JSON.parse(readFileSync(resolve(p), "utf8")); return Array.isArray(d) ? d : (d.cars || []); } catch {}
  }
  return [];
}

// normalize a name for matching: lowercase, drop a 4-digit year, keep alnum only
const norm = (s) => String(s || "").toLowerCase().replace(/\b(19|20)\d{2}\b/g, "").replace(/[^a-z0-9]+/g, "");
const gonzoPrice = (g) => { const n = parseInt(String(g.price || "").replace(/[^\d]/g, ""), 10); return Number.isFinite(n) && n > 1000 ? n : 0; };

async function main() {
  const env = loadEnv();
  const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
  const H = { apikey: K, authorization: `Bearer ${K}`, "content-type": "application/json" };

  const gonzo = readGonzo().filter((g) => g.kind === "car" || !g.kind);
  // build lookup: normalized name -> best (highest-priced) gonzo entry with a price
  const gmap = new Map();
  for (const g of gonzo) { const k = norm(g.name); if (!k) continue; const p = gonzoPrice(g); const cur = gmap.get(k); if (!cur || p > gonzoPrice(cur)) gmap.set(k, g); }
  console.log(`gonzo cars: ${gonzo.length} | with price: ${gonzo.filter((g) => gonzoPrice(g)).length} | unique names: ${gmap.size}`);

  const cars = await (await fetch(`${U}/rest/v1/cars?select=id,slug,brand,model,year,price_usd&limit=400`, { headers: H })).json();
  console.log(`tez cars: ${cars.length}\n`);

  const matched = [], unmatched = [];
  for (const c of cars) {
    const key = norm(`${c.brand} ${c.model}`);
    // exact normalized, else gonzo-name contains our key (>=6 chars) or vice-versa
    let g = gmap.get(key);
    if (!g) for (const [gk, gv] of gmap) { if (key.length >= 6 && (gk.includes(key) || key.includes(gk)) && gonzoPrice(gv)) { g = gv; break; } }
    const gp = g ? gonzoPrice(g) : 0;
    if (g && gp) matched.push({ c, g, newPrice: gp - DELTA });
    else unmatched.push(c);
  }
  console.log(`=== MATCHED ${matched.length} (will set price = Gonzo CIP - $${DELTA}) ===`);
  for (const m of matched) console.log(`  ${m.c.slug}  [${m.c.brand} ${m.c.model}] ← "${m.g.name}" $${gonzoPrice(m.g)} → $${m.newPrice}  (was $${m.c.price_usd})`);
  console.log(`\n=== UNMATCHED ${unmatched.length} (need deduction/research) ===`);
  for (const c of unmatched) console.log(`  ${c.slug}  [${c.brand} ${c.model} ${c.year}]  (was $${c.price_usd})`);

  if (WRITE) {
    let n = 0;
    for (const m of matched) {
      const r = await fetch(`${U}/rest/v1/cars?id=eq.${m.c.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ price_usd: m.newPrice }) });
      if (r.ok) n++;
    }
    console.log(`\n── WROTE ${n}/${matched.length} prices ──`);
  } else {
    console.log(`\n(dry-run — re-run with --write to PATCH)`);
  }
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
