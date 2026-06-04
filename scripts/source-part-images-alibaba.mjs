/**
 * Source product photos for catalog parts from Alibaba (m.alibaba.com search) and
 * re-host them into Supabase part-images. The desktop site captchas datacenter
 * IPs, but the MOBILE search (m.alibaba.com) returns real product listings whose
 * thumbnails live on alicdn.com — downloadable at full resolution (strip the
 * _NxN size suffix), no proxy or Referer needed.
 *
 * Matching is by part NAME (+ automotive context) → a representative product
 * photo. These are real Alibaba product images for the part type, NOT guaranteed
 * to be the exact OEM SKU — appropriate for a parts catalog, and the dealer
 * reviews. Only parts that currently have NO images are touched (idempotent).
 *
 *   node scripts/source-part-images-alibaba.mjs            # all imageless parts
 *   node scripts/source-part-images-alibaba.mjs --limit=5  # try a few first
 *   node scripts/source-part-images-alibaba.mjs --per=2    # images per part (default 2)
 *   node scripts/source-part-images-alibaba.mjs --dry      # search + report, no writes
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const UA_MOBILE = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";
const UA_DESK = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MIN_BYTES = 12_000;
const MAX_BYTES = 10 * 1024 * 1024;

const ARGS = process.argv.slice(2);
const DRY = ARGS.includes("--dry");
const LIMIT = Number((ARGS.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0);
const PER = Number((ARGS.find((a) => a.startsWith("--per=")) || "").split("=")[1] || 2);

function loadEnv() {
  const env = {};
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return env;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Search m.alibaba.com and return candidate PRODUCT image URLs (full-res). */
async function searchImages(query) {
  const url = `https://m.alibaba.com/trade/search?SearchText=${encodeURIComponent(query)}`;
  const r = await fetch(url, { headers: { "user-agent": UA_MOBILE, accept: "text/html" }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) return [];
  const html = await r.text();
  const out = [];
  const seen = new Set();
  for (const m of html.matchAll(/https?:\/\/[a-z0-9.]*alicdn\.com\/[^"'\s\\]*?\.(?:jpg|jpeg|png|webp)(?:_\d+x\d+\.(?:jpg|jpeg|png|webp))?/gi)) {
    const raw = m[0];
    // Product photos live under /kf/. Skip banners/sprites/UI assets.
    if (!/\/kf\//i.test(raw)) continue;
    if (/tps-|creatives-assets|ossgw|imgextra\/i\d\/O1CN.*tps/i.test(raw)) continue;
    // Upsize: strip the _NxN thumbnail suffix to get the original.
    const full = raw.replace(/_(\d+)x(\d+)\.(jpg|jpeg|png|webp)$/i, "");
    const key = full.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(full);
  }
  return out;
}

function sniffMime(b) {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}
const extFor = (m) => (m === "image/jpeg" ? "jpg" : m === "image/png" ? "png" : "webp");

async function rehost(sb, url, partId) {
  const r = await fetch(url, { headers: { "user-agent": UA_DESK, accept: "image/*", referer: "https://www.alibaba.com/" }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`img ${r.status}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.byteLength < MIN_BYTES) throw new Error("too small");
  if (bytes.byteLength > MAX_BYTES) throw new Error("too large");
  const mime = sniffMime(bytes);
  if (!mime) throw new Error("not an image");
  const path = `alibaba/${partId}-${Math.random().toString(36).slice(2, 10)}.${extFor(mime)}`;
  const up = await sb.storage.from("part-images").upload(path, bytes, { contentType: mime, cacheControl: "31536000", upsert: false });
  if (up.error) throw new Error(up.error.message);
  return sb.storage.from("part-images").getPublicUrl(path).data.publicUrl;
}

/** Build a focused automotive query from a part's fields. */
function queryFor(p) {
  const name = (p.name_en || p.name_ru || "").trim();
  const brand = (p.fits_brands || [])[0];
  return [name, brand && `for ${brand}`, "car auto"].filter(Boolean).join(" ").slice(0, 80);
}

async function main() {
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: parts, error } = await sb
    .from("parts")
    .select("id,name_ru,name_en,category,oem_number,images,fits_brands")
    .order("category");
  if (error) throw error;
  let pool = (parts || []).filter((p) => !p.images || p.images.length === 0);
  if (LIMIT) pool = pool.slice(0, LIMIT);
  console.log(`${pool.length} imageless part(s) to process${DRY ? " (dry run)" : ""}\n`);

  const stats = { withImages: 0, imagesAdded: 0, noResults: 0 };
  for (const p of pool) {
    const q = queryFor(p);
    let candidates = [];
    try { candidates = await searchImages(q); } catch (e) { console.log(`· ${p.name_en || p.name_ru} — search failed: ${e.message}`); }
    if (!candidates.length) { stats.noResults++; console.log(`· ${p.name_en || p.name_ru} — no product images for "${q}"`); await sleep(1500); continue; }

    if (DRY) { console.log(`✓ ${p.name_en || p.name_ru} → ${candidates.length} candidates (e.g. ${candidates[0].slice(0, 70)})`); await sleep(1200); continue; }

    const hosted = [];
    for (const u of candidates) {
      if (hosted.length >= PER) break;
      try { hosted.push(await rehost(sb, u, p.id)); } catch { /* skip bad */ }
    }
    if (hosted.length) {
      const { error: upErr } = await sb.from("parts").update({ images: hosted }).eq("id", p.id);
      if (upErr) console.log(`  ! update failed: ${upErr.message}`);
      else { stats.withImages++; stats.imagesAdded += hosted.length; console.log(`✓ ${p.name_en || p.name_ru} [${p.category}] → ${hosted.length} image(s)`); }
    } else {
      stats.noResults++;
      console.log(`· ${p.name_en || p.name_ru} — candidates found but none re-hostable`);
    }
    await sleep(1800); // gentle
  }

  console.log(`\n── done ──`);
  console.log(`parts imaged: ${stats.withImages} | images added: ${stats.imagesAdded} | no usable image: ${stats.noResults}`);
}

main().catch((e) => { console.error(e?.stack || String(e)); process.exit(1); });
