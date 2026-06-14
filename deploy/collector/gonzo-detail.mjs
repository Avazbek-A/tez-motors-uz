/**
 * Enrich cars.spec_data with per-trim CIP-Tashkent prices + the растаможка
 * (customs) figure, scraped from the matched Gonzo detail page.
 *
 * Gonzo's catalog card only carries the starting price (used by gonzo-pricing.mjs).
 * The DETAIL page additionally lists every trim's CIP price and a "Таможня: N$"
 * customs figure — both plain text, no JS render needed. We match tez cars ↔ Gonzo
 * by normalized brand+model (same logic as gonzo-pricing.mjs), fetch each matched
 * detail page, parse, and shallow-merge { customs_usd, gonzo_trims } into spec_data.
 *
 *   gonzo_trims[].price_usd = Gonzo CIP − $100   (the catalog's pricing rule)
 *   customs_usd             = Gonzo "Таможня" raw (a separate pass-through cost)
 *
 * Resume-safe: a car that already has spec_data.customs_usd is skipped unless --force.
 * Run AFTER the colors batch (autohome-colors.mjs) to avoid a spec_data write race.
 *
 * Run:  node gonzo-detail.mjs            (dry — parse + report, no writes)
 *       node gonzo-detail.mjs --write    (PATCH spec_data)
 *       node gonzo-detail.mjs --write --force   (re-scrape even if already set)
 *       node gonzo-detail.mjs --series zeekr     (limit to slugs containing a string)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WRITE = process.argv.includes("--write");
const FORCE = process.argv.includes("--force");
const ONLY = (() => { const i = process.argv.indexOf("--series"); return i > 0 ? (process.argv[i + 1] || "").toLowerCase() : ""; })();
const DELTA = 100; // $ cheaper than Gonzo, matching gonzo-pricing.mjs
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

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

const norm = (s) => String(s || "").toLowerCase().replace(/\b(19|20)\d{2}\b/g, "").replace(/[^a-z0-9]+/g, "");
const gonzoPrice = (g) => { const n = parseInt(String(g.price || "").replace(/[^\d]/g, ""), 10); return Number.isFinite(n) && n > 1000 ? n : 0; };
const toUsd = (s) => { const n = parseInt(String(s || "").replace(/[^\d]/g, ""), 10); return Number.isFinite(n) ? n : 0; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// strip tags → collapsed plain text (Gonzo text is already RU/EN, no GBK)
function toText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#34;|&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse the "CIP Tashkent: …" trim list + the "Таможня: N$" customs figure. */
function parseDetail(text) {
  const trims = [];
  let customs = 0;

  // customs — "Таможня: 9.500$" / "Растаможка 9 500 $"
  const cm = text.match(/(?:Таможн[яи]|Растаможк[аи])\s*[:\-—]?\s*([\d.,\s]{2,})\$/i);
  if (cm) { const c = toUsd(cm[1]); if (c >= 100 && c <= 200000) customs = c; }

  // CIP block — everything between "CIP Tashkent" and the customs label (or a bounded span)
  const ci = text.search(/CIP\s*Tashkent/i);
  if (ci >= 0) {
    let block = text.slice(ci + text.slice(ci).search(/CIP\s*Tashkent/i)).replace(/^CIP\s*Tashkent\s*[:\-—]?\s*/i, "");
    const stop = block.search(/(?:Таможн[яи]|Растаможк[аи])/i);
    if (stop > 0) block = block.slice(0, stop);
    // each trim chunk ends at a "$"; "<label> - <price>"
    for (const raw of block.split("$")) {
      const chunk = raw.trim();
      if (!chunk) continue;
      const m = chunk.match(/^(.+?)[-–—]\s*([\d.,\s]{3,})$/); // greedy label up to the LAST dash before the trailing number
      const m2 = chunk.match(/^(.+)[-–—]\s*([\d.,\s]{3,})$/);
      const use = m2 || m;
      if (!use) continue;
      const label = use[1].replace(/\s+/g, " ").trim();
      const cip = toUsd(use[2]);
      if (label.length < 3 || label.length > 90) continue;
      if (cip < 5000 || cip > 500000) continue; // sane CIP band
      trims.push({ label, price_usd: cip - DELTA });
    }
  }
  return { trims, customs };
}

async function fetchText(url) {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "ru,en;q=0.8" }, signal: AbortSignal.timeout(25000) });
    if (!r.ok) return null;
    return toText(await r.text());
  } catch { return null; }
}

async function main() {
  const env = loadEnv();
  const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!U || !K) { console.error("FATAL: missing Supabase env (.env.local)"); process.exit(1); }
  const H = { apikey: K, authorization: `Bearer ${K}`, "content-type": "application/json" };

  const gonzo = readGonzo().filter((g) => g.kind === "car" || !g.kind);
  const gmap = new Map();
  for (const g of gonzo) { const k = norm(g.name); if (!k) continue; const p = gonzoPrice(g); const cur = gmap.get(k); if (!cur || p > gonzoPrice(cur)) gmap.set(k, g); }
  console.log(`gonzo cars: ${gonzo.length} | unique names: ${gmap.size} | mode: ${WRITE ? "WRITE" : "DRY"}${FORCE ? " +force" : ""}${ONLY ? ` only:${ONLY}` : ""}`);

  const cars = await (await fetch(`${U}/rest/v1/cars?select=id,slug,brand,model,year,price_usd,spec_data&limit=400`, { headers: H })).json();

  const matched = [];
  for (const c of cars) {
    if (ONLY && !`${c.slug} ${c.brand} ${c.model}`.toLowerCase().includes(ONLY)) continue;
    const key = norm(`${c.brand} ${c.model}`);
    let g = gmap.get(key);
    if (!g) for (const [gk, gv] of gmap) { if (key.length >= 6 && (gk.includes(key) || key.includes(gk)) && gonzoPrice(gv)) { g = gv; break; } }
    if (g && g.url) matched.push({ c, g });
  }
  console.log(`matched cars with a Gonzo URL: ${matched.length}\n`);

  let scraped = 0, wrote = 0, skipped = 0, empty = 0;
  for (const { c, g } of matched) {
    // "Done" = already has customs OR a per-trim list (a trims-only car just means
    // Gonzo has no Таможня for it — re-fetching won't help). Retry only the un-enriched.
    const already = c.spec_data && (typeof c.spec_data.customs_usd === "number" ||
      (Array.isArray(c.spec_data.gonzo_trims) && c.spec_data.gonzo_trims.length > 0));
    if (already && !FORCE) { skipped++; continue; }

    const text = await fetchText(g.url);
    await sleep(300); // gentle
    if (!text) { console.log(`  ✗ ${c.slug}  (fetch failed) ${g.url}`); empty++; continue; }
    const { trims, customs } = parseDetail(text);
    if (!trims.length && !customs) { console.log(`  · ${c.slug}  (no CIP/Таможня block) ${g.url}`); empty++; continue; }
    scraped++;
    console.log(`  ✓ ${c.slug}  customs=$${customs || "—"}  trims=${trims.length}${trims.length ? "  [" + trims.map((t) => "$" + t.price_usd).join(", ") + "]" : ""}`);

    if (WRITE) {
      // re-read current spec_data right before merge (race-safe even if colors batch runs)
      let sd = c.spec_data || {};
      try {
        const cur = await (await fetch(`${U}/rest/v1/cars?id=eq.${c.id}&select=spec_data`, { headers: H })).json();
        if (Array.isArray(cur) && cur[0] && cur[0].spec_data) sd = cur[0].spec_data;
      } catch {}
      const merged = { ...sd };
      if (customs) merged.customs_usd = customs;
      if (trims.length) merged.gonzo_trims = trims;
      const r = await fetch(`${U}/rest/v1/cars?id=eq.${c.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ spec_data: merged }) });
      if (r.ok) wrote++; else console.log(`     PATCH ${r.status} ${await r.text()}`);
    }
  }
  console.log(`\n── scraped ${scraped} | wrote ${wrote} | skipped(already) ${skipped} | empty/failed ${empty} ──`);
  if (!WRITE) console.log("(dry-run — re-run with --write to PATCH spec_data)");
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
