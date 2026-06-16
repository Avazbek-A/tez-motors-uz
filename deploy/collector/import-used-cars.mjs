/**
 * Ingest olx-used-cars.json into the `cars` table as listing_type='used' rows for
 * the /used classifieds section. Photos are REHOSTED to the car-images bucket (same
 * contract as the parts/colors collectors). These are aggregated third-party market
 * listings, so every row carries a provenance note + source URL in description_ru,
 * and a marker in `specs.market_source` so the UI/admin can tell them apart.
 *
 * The user opted into "publish as classifieds", so rows land is_published=true and
 * inventory_status='available' (visible on /used). `in_stock` stays false (default)
 * → they never count as Tez's own stock or feed the buy-price engine. Inserts are
 * ADDITIVE (on_conflict=slug, ignore-duplicates) so re-runs never clobber edits.
 *
 * Run (dry):   node import-used-cars.mjs
 * Run (write): node import-used-cars.mjs --write
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WRITE = process.argv.includes("--write");
const IN = process.env.USED_JSON || "./olx-used-cars.json";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

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

function sniff(b) {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57) return "image/webp";
  return null;
}
async function rehost(url) {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "image/*" }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`img ${r.status}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.byteLength < 8000 || bytes.byteLength > 12 * 1024 * 1024) throw new Error("size");
  const mime = sniff(bytes); if (!mime) throw new Error("not image");
  const up = await fetch(`${MEDIA_URL}/api/admin/disk-image?bucket=car-images&dir=olx-used`, {
    method: "POST", headers: { "content-type": mime, authorization: `Bearer ${MEDIA_SECRET}` }, body: bytes, signal: AbortSignal.timeout(30000),
  });
  if (!up.ok) throw new Error(`disk ${up.status}`);
  const j = await up.json(); if (!j.url) throw new Error("disk no url");
  return j.url;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isJunk(r) {
  if (!r.brand || !r.model || !r.year || !r.price_usd) return true;
  if (r.year < 1980 || r.year > 2027) return true;
  // Plausible UZ used-car USD band — drops $0 teasers and absurd outliers / typo prices.
  if (r.price_usd < 1500 || r.price_usd > 250000) return true;
  if (!Array.isArray(r.images) || r.images.length === 0) return true;
  return false;
}

async function main() {
  if (!U || !K) { console.error("FATAL: missing Supabase env"); process.exit(1); }
  if (!MEDIA_SECRET) { console.error("FATAL: MEDIA_UPLOAD_SECRET unset (needed to rehost photos)"); process.exit(1); }
  const rows = JSON.parse(readFileSync(resolve(IN), "utf8"));
  console.log(`read ${rows.length} collected used cars from ${IN}`);

  const records = [];
  let rehosted = 0, junk = 0, photoFail = 0;
  for (const r of rows) {
    if (isJunk(r)) { junk++; continue; }
    // Rehost up to 6 photos; keep the ones that survive. Need ≥1.
    const imgs = [];
    for (const src of r.images.slice(0, 6)) {
      try { imgs.push(await rehost(src)); rehosted++; await sleep(120); }
      catch { await sleep(120); }
    }
    if (imgs.length === 0) { photoFail++; continue; }

    const provenance = [
      "Рыночное объявление, агрегировано с OLX (не проверено Tez Motors).",
      r.city && `Город: ${r.city}`,
      r.condition_grade && `Состояние: ${r.condition_grade}`,
      r.owners_count != null && `Владельцев: ${r.owners_count}`,
      r.url && `Источник: ${r.url}`,
    ].filter(Boolean).join(" · ");

    records.push({
      slug: r.slug,
      brand: r.brand,
      model: String(r.model).slice(0, 80),
      year: r.year,
      price_usd: r.price_usd,
      listing_type: "used",
      is_published: true,            // user chose "publish as classifieds"
      inventory_status: "available", // visible; in_stock stays false (not Tez stock)
      mileage: r.mileage ?? 0,
      transmission: r.transmission || "automatic",
      fuel_type: r.fuel_type || "petrol",
      body_type: r.body_type || "sedan",
      color: r.color || null,
      owners_count: r.owners_count ?? null,
      accident_free: null,
      condition_grade: r.condition_grade || null,
      description_ru: provenance.slice(0, 600),
      images: imgs,
      thumbnail: imgs[0],
      specs: { market_source: "olx", source_url: r.url || null },
    });
  }
  console.log(`prepared ${records.length} used-car rows (rehosted ${rehosted} photos · junk-skipped ${junk} · photo-failed ${photoFail})`);
  if (!WRITE) { console.log("(dry-run; pass --write to insert)"); return; }

  let ok = 0;
  for (let i = 0; i < records.length; i += 40) {
    const batch = records.slice(i, i + 40);
    const res = await fetch(`${U}/rest/v1/cars?on_conflict=slug`, {
      method: "POST", headers: { ...H, Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(batch),
    });
    if (res.ok) ok += batch.length; else console.log(`batch ${i} FAIL ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  console.log(`done — sent ${ok} used-car rows (new slugs published to /used; existing left untouched).`);
}
main().catch((e) => { console.error(e?.stack || String(e)); process.exit(1); });
