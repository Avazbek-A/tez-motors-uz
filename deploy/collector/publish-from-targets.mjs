/**
 * Publish stage (Phase GONZO) — turn matched AutoHome targets into tezmotors catalog
 * cars: decode the full spec (autohome-extract) → translate RU/UZ/EN (cn-spec-dict) →
 * re-host the hi-res AutoHome gallery → upsert a `cars` row.
 *
 * SAFETY: DRY-RUN by default (writes ./publish-preview.json, NO DB writes, quick sample).
 * `--write` actually upserts (service-role, .env.local on this Mac). Rows are marked
 * specs.source='autohome' (identifiable + removable). Existing slugs are ENRICHED
 * (spec_data + photos only), never clobbered — new slugs are inserted. HIGH-confidence
 * targets only by default (--tier=all to include medium). Cars with no Gonzo price are
 * skipped (price_usd is required; the dealer sets landed price anyway).
 *
 *   node publish-from-targets.mjs                 # quick dry-run preview (15 cars)
 *   node publish-from-targets.mjs --all           # dry-run ALL high targets
 *   node publish-from-targets.mjs --write          # CREATE high targets in the catalog
 *   node publish-from-targets.mjs --write --tier=all --limit=50
 */
import { readFileSync, writeFileSync } from "node:fs";
import { openBrowser, extractAutohomeSpec } from "./autohome-extract.mjs";
import { translateSpec } from "./cn-spec-dict.mjs";
import { log } from "./crawlee-shared.mjs";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const REFERER = "https://car.autohome.com.cn/";
const ARGS = process.argv.slice(2);
const WRITE = ARGS.includes("--write");
const ALL = ARGS.includes("--all");
// Resume-friendly: by default skip targets already enriched with disk-hosted
// photos (so a re-run finishes the remaining set instead of re-rendering everything).
// Pass --force to re-enrich every target regardless.
const FORCE = ARGS.includes("--force");
const TIER = (ARGS.find((a) => a.startsWith("--tier=")) || "").split("=")[1] || "high";
const LIMIT = Number((ARGS.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0)
  || (!WRITE && !ALL ? 15 : 0); // quick dry-run sample unless --all/--write
const TARGETS = process.env.AUTOHOME_TARGETS || "./autohome-targets.json";
const MAX_IMAGES = 20, MIN_PHOTO_BYTES = 12000, MAX_PHOTO_BYTES = 12 * 1024 * 1024;
// Image store: when MEDIA_UPLOAD_URL+SECRET are set, photos go to the Vostro's disk
// (via /api/admin/disk-image, no size cap); otherwise they re-host to Supabase Storage.
const MEDIA_URL = (process.env.MEDIA_UPLOAD_URL || "").replace(/\/$/, "");
const MEDIA_SECRET = process.env.MEDIA_UPLOAD_SECRET || "";
const USE_DISK = !!(MEDIA_URL && MEDIA_SECRET);

// --- field derivation ---
const MULTIWORD = ["land rover", "aston martin", "mercedes benz", "rolls royce"];
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
function parseName(name) {
  const low = name.toLowerCase();
  for (const mw of MULTIWORD) if (low.startsWith(mw)) return { brand: titleCase(mw), model: name.slice(mw.length).trim() || name };
  const t = name.trim().split(/\s+/);
  return { brand: titleCase(t[0]), model: t.slice(1).join(" ") || t[0] };
}
const priceUsd = (raw) => { const v = parseInt(String(raw || "").replace(/[^\d]/g, ""), 10); return Number.isFinite(v) && v > 0 ? v : null; };
function specVal(spec, re) {
  for (const t of spec.trims) for (const sec of Object.values(t.params)) for (const [k, v] of Object.entries(sec)) if (re.test(k)) return String(v);
  return "";
}
function yearFrom(name, spec) {
  const m = String(name).match(/20\d\d/); if (m) return +m[0];
  const v = specVal(spec, /上市时间|launch/i).match(/20\d\d/); return v ? +v[0] : 2025;
}
function fuelType(spec) {
  const v = specVal(spec, /能源类型/);
  if (/纯电/.test(v)) return "electric";
  if (/插电|phev/i.test(v)) return "phev";
  if (/混动|油电|hybrid/i.test(v)) return "hybrid";
  return "petrol";
}
function bodyType(spec) {
  const v = specVal(spec, /级别/) + " " + specVal(spec, /车身结构/);
  if (/SUV/i.test(v)) return "suv";
  if (/MPV/i.test(v)) return "minivan";
  if (/跑车|轿跑|coupe/i.test(v)) return "coupe";
  if (/两厢/.test(v)) return "hatchback";
  if (/三厢|轿车|sedan/i.test(v)) return "sedan";
  return "sedan";
}
function powerHp(spec) { const kw = parseFloat(specVal(spec, /最大功率|电动机总功率/)); return Number.isFinite(kw) && kw > 0 ? Math.round(kw * 1.341) : null; }
function engineL(spec) { const l = parseFloat(specVal(spec, /排量\(L\)/)); return Number.isFinite(l) && l > 0 && l < 10 ? l : null; }
function slugify(s) { return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 110); }

// --- hi-res gallery from the CN pic page (size-templated autoimg URLs) ---
// AutoHome serves cardfs thumbs as ".../{W}x{H}_0_q95_c42_autohomecar__HASH.jpg".
// Swap the leading size token → 1100x0 (≈1100×825, ~280KB) for a sharp web image
// (vs the 480×360 thumb). Dedupe by the photo HASH so the same shot at different
// sizes counts once. (Recon: page 1 alone exposes ~54 distinct photos.)
const upsize = (u) => (u.startsWith("//") ? "https:" + u : u).replace(/\/\d{2,4}x\d{1,4}_/, "/1100x0_");
const photoHash = (u) => (u.match(/autohomecar__([A-Za-z0-9]+)/) || u.match(/([A-Za-z0-9]{20,})\.(?:jpe?g|png|webp)/i) || [, u])[1];
async function gallery(seriesId, browser) {
  const ctx = await browser.newContext({ userAgent: UA, locale: "zh-CN", viewport: { width: 1400, height: 2400 } });
  const page = await ctx.newPage();
  try {
    await page.goto(`https://car.autohome.com.cn/pic/series/${seriesId}.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.evaluate(async () => { for (let y = 0; y < 14000; y += 900) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 220)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(400);
    const urls = await page.evaluate(() => Array.from(document.querySelectorAll("img")).map((i) => i.getAttribute("data-original") || i.getAttribute("src") || "").filter(Boolean));
    const cardfs = urls.filter((u) => /autoimg\.cn\/.*cardfs/i.test(u)).map(upsize);
    const seen = new Set(), out = [];
    for (const u of cardfs) { const h = photoHash(u); if (h && seen.has(h)) continue; if (h) seen.add(h); out.push(u); if (out.length >= 30) break; }
    return out;
  } catch { return []; } finally { await ctx.close(); }
}
function sniff(b) {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57) return "image/webp";
  return null;
}
async function fetchPhoto(url) {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "image/*", referer: REFERER }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`img ${r.status}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.byteLength < MIN_PHOTO_BYTES || bytes.byteLength > MAX_PHOTO_BYTES) throw new Error("size");
  const mime = sniff(bytes); if (!mime) throw new Error("not image");
  return { bytes, mime };
}
// Supabase Storage re-host (1GB free cap).
async function rehost(sb, url, seriesId) {
  const { bytes, mime } = await fetchPhoto(url);
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
  const path = `autohome/${seriesId}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const up = await sb.storage.from("car-images").upload(path, bytes, { contentType: mime, cacheControl: "31536000", upsert: false });
  if (up.error) throw new Error(up.error.message);
  return sb.storage.from("car-images").getPublicUrl(path).data.publicUrl;
}
// Vostro-disk re-host (no size cap): POST bytes to the app's /api/admin/disk-image.
async function rehostToDisk(url) {
  const { bytes, mime } = await fetchPhoto(url);
  const up = await fetch(`${MEDIA_URL}/api/admin/disk-image?bucket=car-images&dir=autohome`, {
    method: "POST",
    headers: { "content-type": mime, authorization: `Bearer ${MEDIA_SECRET}` },
    body: bytes,
    signal: AbortSignal.timeout(30000),
  });
  if (!up.ok) throw new Error(`disk ${up.status}`);
  const j = await up.json();
  if (!j.url) throw new Error("disk: no url");
  return j.url;
}
const rehostPhoto = (sb, url, seriesId) => (USE_DISK ? rehostToDisk(url) : rehost(sb, url, seriesId));

function loadEnv() {
  const env = {};
  // .env.local lives at the repo root; this script runs from deploy/collector — search up.
  let raw = "";
  for (const p of [".env.local", "../.env.local", "../../.env.local"]) {
    try { raw = readFileSync(p, "utf8"); if (raw) break; } catch { /* next */ }
  }
  try { for (const line of raw.split("\n")) { const i = line.indexOf("="); if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); } } catch {}
  return env;
}

async function main() {
  const all = JSON.parse(readFileSync(TARGETS, "utf8"));
  let targets = TIER === "all" ? all : all.filter((t) => (t.confidence || 0) >= 0.9);
  if (LIMIT) targets = targets.slice(0, LIMIT);
  log.info(`publish: ${targets.length} ${TIER} target(s)${WRITE ? " — WILL UPSERT cars" : " — DRY-RUN (preview only)"}`);
  if (WRITE) log.info(`  image store: ${USE_DISK ? `Vostro disk → ${MEDIA_URL}` : "Supabase Storage (1GB free cap)"}`);

  let sb = null;
  if (WRITE) {
    const env = loadEnv();
    const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) { log.error("--write needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local"); process.exit(1); }
    const { createClient } = await import("@supabase/supabase-js");
    sb = createClient(url, key);
  }

  const browser = await openBrowser();
  const preview = [], skipped = { decode: [], noPrice: [], exists: [] };
  let created = 0, enriched = 0;
  try {
    for (const t of targets) {
      // Resume: skip if this target is already enriched with disk-hosted photos.
      // Keyed on specs->>gonzo_name (known upfront — no render needed), so a re-run
      // picks up where it left off instead of redoing the expensive decode+gallery.
      if (WRITE && !FORCE) {
        const { data: done } = await sb
          .from("cars")
          .select("id,spec_data,images")
          .eq("specs->>gonzo_name", t.gonzoName)
          .limit(1)
          .maybeSingle();
        if (
          done && done.spec_data &&
          Array.isArray(done.images) &&
          done.images.some((u) => typeof u === "string" && u.includes("/api/media/"))
        ) {
          skipped.exists.push(t.gonzoName);
          log.info(`  = skip ${t.gonzoName} (already enriched)`);
          continue;
        }
      }
      const r = await extractAutohomeSpec(t.url, { browser });
      if (!r.ok) { skipped.decode.push(t.gonzoName); log.warning(`· ${t.gonzoName}: decode failed (${r.reason || (r.blocked ? "blocked" : "?")})`); continue; }
      const price = priceUsd(t.gonzoPrice);
      if (!price) { skipped.noPrice.push(t.gonzoName); continue; }
      const spec = await translateSpec(r.spec, {}); // dict-only translation (LLM optional, not wired here)
      const { brand, model } = parseName(t.gonzoName);
      const year = yearFrom(t.gonzoName, r.spec);
      const slug = slugify(/20\d\d/.test(model) ? `${brand} ${model}` : `${brand} ${model} ${year}`); // avoid year dup
      const row = {
        slug, brand, model, year, price_usd: price,
        body_type: bodyType(r.spec), fuel_type: fuelType(r.spec),
        engine_power: powerHp(r.spec), engine_volume: engineL(r.spec),
        transmission: "automatic", mileage: 0, inventory_status: "available",
        is_hot_offer: false, order_position: 0,
        spec_data: spec, spec_captured_at: new Date().toISOString(),
        specs: { source: "autohome", autohome_id: t.seriesId, gonzo_name: t.gonzoName, confidence: t.confidence },
        images: [],
      };
      const p = { slug, brand, model, year, price_usd: price, fuel_type: row.fuel_type, body_type: row.body_type, engine_power: row.engine_power, trims: r.spec.trims.length, autohome: t.autohomeName };

      if (WRITE) {
        const g = await gallery(t.seriesId, browser);
        const imgs = [];
        for (const u of g) { if (imgs.length >= MAX_IMAGES) break; try { imgs.push(await rehostPhoto(sb, u, t.seriesId)); } catch { /* skip bad */ } }
        row.images = imgs; row.thumbnail = imgs[0] || null;
        const { data: ex } = await sb.from("cars").select("id,images").eq("slug", slug).maybeSingle();
        if (ex) {
          // AutoHome-sourced cars: REPLACE with the fresh hi-res set (don't keep old 480×360);
          // only fall back to existing images if this gallery fetch came back empty.
          const newImages = imgs.length ? imgs : (Array.isArray(ex.images) ? ex.images : []);
          const { error } = await sb.from("cars").update({ spec_data: row.spec_data, spec_captured_at: row.spec_captured_at, images: newImages, thumbnail: newImages[0] || null, specs: row.specs }).eq("id", ex.id);
          if (error) log.error(`  ! ${slug}: ${error.message}`); else { enriched++; log.info(`  ~ enriched ${slug} (${imgs.length} hi-res photos)`); }
          skipped.exists.push(slug);
        } else {
          const { error } = await sb.from("cars").insert(row);
          if (error) log.error(`  ! ${slug}: ${error.message}`); else { created++; log.info(`  + created ${slug} (${imgs.length} photos, ${r.spec.trims.length} trims)`); }
        }
        p.images = imgs.length;
      } else {
        p.images = "(fetched on --write)";
        log.info(`  ◦ ${slug}  ${row.fuel_type}/${row.body_type}  $${price}  ${r.spec.trims.length} trims`);
      }
      preview.push(p);
    }
  } finally {
    await browser.close();
  }

  writeFileSync("./publish-preview.json", JSON.stringify(preview, null, 2));
  log.info(`\n── ${WRITE ? "publish" : "dry-run"} done ──`);
  if (WRITE) log.info(`created: ${created} | enriched existing: ${enriched}`);
  log.info(`previewed: ${preview.length} | skipped — decode: ${skipped.decode.length}, no-price: ${skipped.noPrice.length}${WRITE ? `, existed: ${skipped.exists.length}` : ""}`);
  log.info(`wrote ./publish-preview.json`);
  if (!WRITE) log.info(`review it, then run with --write (and --all for the full ${TIER} set) to create cars.`);
}

main().catch((e) => { log.error(e?.stack || String(e)); process.exit(1); });
