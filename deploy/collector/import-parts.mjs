/**
 * Ingest the OLX parts collector's output (olx-parts.json) into the `parts` table
 * as reviewable DRAFTS, with photos REHOSTED to the Vostro disk (part-images bucket).
 *
 * Quality gate preserved: rows land is_published=false (not public until the dealer
 * reviews + publishes in Admin → Parts). Inserts are ADDITIVE — existing slugs are
 * IGNORED (resolution=ignore-duplicates), so re-runs never clobber a reviewed/edited
 * or published part. Rows without a working photo are dropped (a catalogue needs pics).
 *
 * Run (dry):   node import-parts.mjs
 * Run (write): node import-parts.mjs --write
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WRITE = process.argv.includes("--write");
const IN = process.env.PARTS_JSON || "./olx-parts.json";
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
  const up = await fetch(`${MEDIA_URL}/api/admin/disk-image?bucket=part-images&dir=olx`, {
    method: "POST", headers: { "content-type": mime, authorization: `Bearer ${MEDIA_SECRET}` }, body: bytes, signal: AbortSignal.timeout(30000),
  });
  if (!up.ok) throw new Error(`disk ${up.status}`);
  const j = await up.json(); if (!j.url) throw new Error("disk no url");
  return j.url;
}
const splitList = (s) => String(s || "").split(";").map((x) => x.trim()).filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!U || !K) { console.error("FATAL: missing Supabase env"); process.exit(1); }
  if (!MEDIA_SECRET) { console.error("FATAL: MEDIA_UPLOAD_SECRET unset (needed to rehost photos)"); process.exit(1); }
  const rows = JSON.parse(readFileSync(resolve(IN), "utf8"));
  console.log(`read ${rows.length} collected parts from ${IN}`);

  const records = [];
  let rehosted = 0, noPhoto = 0, failedPhoto = 0;
  for (const r of rows) {
    if (!r.name_ru) continue;
    if (!r.images) { noPhoto++; continue; } // catalogue entries must have a photo
    let img;
    try { img = await rehost(r.images); rehosted++; } catch { failedPhoto++; await sleep(150); continue; }
    await sleep(120);
    const price = Number(r.price_usd);
    records.push({
      slug: r.slug,
      oem_number: r.oem_number || null,
      name_ru: String(r.name_ru).slice(0, 200),
      name_uz: r.name_uz || null,
      name_en: r.name_en || null,
      description_ru: r.description_ru || null,
      category: (r.category || "other").toLowerCase(),
      brand: r.brand || null,
      price_usd: Number.isFinite(price) && price > 0 ? price : null,
      stock_qty: 0,
      images: [img],
      is_published: false, // DRAFT — review before publishing
      fits_brands: splitList(r.fits_brands),
      fits_models: splitList(r.fits_models),
      fits_year_from: r.fits_year_from || null,
      fits_year_to: r.fits_year_to || null,
    });
  }
  console.log(`prepared ${records.length} drafts (rehosted ${rehosted} photos · no-photo ${noPhoto} · photo-failed ${failedPhoto})`);
  if (!WRITE) { console.log("(dry-run; pass --write to insert)"); return; }

  let ok = 0;
  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50);
    const res = await fetch(`${U}/rest/v1/parts?on_conflict=slug`, {
      method: "POST", headers: { ...H, Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(batch),
    });
    if (res.ok) ok += batch.length; else console.log(`batch ${i} FAIL ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  console.log(`done — sent ${ok} rows (new slugs inserted as DRAFTS; existing left untouched).`);
}
main().catch((e) => { console.error(e?.stack || String(e)); process.exit(1); });
