/**
 * Ingest olx-scooters.json into the `scooters` table as DRAFTS (is_published=false),
 * photos REHOSTED to the car-images bucket under a scooters/ prefix (the migration
 * says scooters reuse that bucket). A best-effort brand/model is set from the title;
 * scooters-llm-clean.mjs then refines brand/model/kind + extracts specs and publishes.
 *
 * Review-gated start: drafts only. Inserts ADDITIVE (on_conflict=slug, ignore-dups).
 * Rows with no working photo, no plausible price, or non-scooter titles are dropped.
 *
 * Run (dry):   node import-scooters.mjs
 * Run (write): node import-scooters.mjs --write
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WRITE = process.argv.includes("--write");
const IN = process.env.SCOOTERS_JSON || "./olx-scooters.json";
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
  const up = await fetch(`${MEDIA_URL}/api/admin/disk-image?bucket=car-images&dir=scooters`, {
    method: "POST", headers: { "content-type": mime, authorization: `Bearer ${MEDIA_SECRET}` }, body: bytes, signal: AbortSignal.timeout(30000),
  });
  if (!up.ok) throw new Error(`disk ${up.status}`);
  const j = await up.json(); if (!j.url) throw new Error("disk no url");
  return j.url;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Known light-EV brands buyers type on OLX.uz — used for a best-effort brand guess.
const BRANDS = ["Kugoo", "Ninebot", "Segway", "Xiaomi", "Teverun", "Dualtron", "Kaabo", "Yadea", "Inokim", "Zero", "Hiper", "Midway", "Tribe", "Artel", "Wattele", "Like.Bike", "Halten", "iKingsmart", "Kingsong", "Aovo"];
const PART_WORDS = /\b(аккумулятор|зарядк|зарядное|колесо|покрышк|камера|шин|запчаст|чехол|подставк|крепление|руль отдельно|только мотор)\b/i;
const SCOOTER_WORDS = /(самокат|scooter|велосипед|велик|e-?bike|ebike|сигвей|segway|гироскутер|моноколес)/i;

function guessBrand(title) {
  const t = title.toLowerCase();
  for (const b of BRANDS) if (t.includes(b.toLowerCase().replace(/\./g, ""))) return b;
  return null;
}
function cleanModel(title) {
  return title.replace(/[+]?\d[\d\s]{4,}\s*(сум|so'?m|uzs|usd|\$)?/gi, " ").replace(/\b(сотилади|продается|продам|срочно|новый|новые|янги|toza|sotiladi|дёшево|дешево)\b/gi, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function isScooter(r) {
  if (!r.title) return true;
  if (!Array.isArray(r.images) || r.images.length === 0) return true;
  const p = Number(r.price_usd);
  if (!Number.isFinite(p) || p < 30 || p > 8000) return true; // plausible light-EV USD band
  if (PART_WORDS.test(r.title) && !SCOOTER_WORDS.test(r.title)) return true; // accessory/part only
  if (!SCOOTER_WORDS.test(r.title) && !guessBrand(r.title)) return true; // neither a scooter word nor a known brand
  return false;
}

async function main() {
  if (!U || !K) { console.error("FATAL: missing Supabase env"); process.exit(1); }
  if (!MEDIA_SECRET) { console.error("FATAL: MEDIA_UPLOAD_SECRET unset (needed to rehost photos)"); process.exit(1); }
  const rows = JSON.parse(readFileSync(resolve(IN), "utf8"));
  console.log(`read ${rows.length} collected scooters from ${IN}`);

  const records = [];
  let rehosted = 0, junk = 0, photoFail = 0;
  for (const r of rows) {
    if (isScooter(r)) { junk++; continue; }
    const imgs = [];
    for (const src of r.images.slice(0, 5)) {
      try { imgs.push(await rehost(src)); rehosted++; await sleep(120); } catch { await sleep(120); }
    }
    if (imgs.length === 0) { photoFail++; continue; }

    const brand = guessBrand(r.title) || (r.kind === "ebike" ? "Электровелосипед" : "Электросамокат");
    const model = cleanModel(r.title) || r.title.slice(0, 80);
    const kind = /велосипед|e-?bike|ebike|велик/i.test(r.title) ? "ebike" : (r.kind || "escooter");
    const desc = ["Рыночное объявление, агрегировано с OLX.", r.city && `Город: ${r.city}`, r.url && `Источник: ${r.url}`].filter(Boolean).join(" · ");

    records.push({
      slug: r.slug,
      kind,
      brand,
      model,
      price_usd: Number(r.price_usd) > 0 ? Number(r.price_usd) : null,
      description_ru: desc.slice(0, 400),
      images: imgs,
      stock_qty: 0,
      is_published: false, // DRAFT — scooters-llm-clean refines + publishes
    });
  }
  console.log(`prepared ${records.length} scooter drafts (rehosted ${rehosted} photos · junk-skipped ${junk} · photo-failed ${photoFail})`);
  if (!WRITE) { console.log("(dry-run; pass --write to insert)"); return; }

  let ok = 0;
  for (let i = 0; i < records.length; i += 40) {
    const batch = records.slice(i, i + 40);
    const res = await fetch(`${U}/rest/v1/scooters?on_conflict=slug`, {
      method: "POST", headers: { ...H, Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(batch),
    });
    if (res.ok) ok += batch.length; else console.log(`batch ${i} FAIL ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  console.log(`done — sent ${ok} scooter drafts (new slugs; existing left untouched). Next: scooters-llm-clean.mjs --write --publish`);
}
main().catch((e) => { console.error(e?.stack || String(e)); process.exit(1); });
