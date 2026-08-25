/**
 * Repair one car's photos when its images[] point at files that are gone.
 *
 * Cars published by publish-from-targets.mjs store their gallery as
 * /api/media/car-images/autohome/<uuid>.jpg, served off the Vostro's disk. If a
 * re-host half-finished (or the files were pruned), the row keeps pointing at
 * paths that answer 404 — the card renders a broken image and Next's optimizer
 * answers 400. This re-scrapes the AutoHome gallery for the car's series and
 * re-hosts a fresh set, then rewrites images[] + thumbnail.
 *
 * Only touches the slugs you name, and only the ones whose files are actually
 * missing (pass --force to re-host regardless).
 *
 *   node repair-car-photos.mjs --slug=yangwang-u7-2026            # dry run
 *   node repair-car-photos.mjs --slug=yangwang-u7-2026 --write
 *
 * Env (repo .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * MEDIA_UPLOAD_URL, MEDIA_UPLOAD_SECRET.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { openBrowser } from "./autohome-extract.mjs";
import { log } from "./crawlee-shared.mjs";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const REFERER = "https://car.autohome.com.cn/";
const ARGS = process.argv.slice(2);
const WRITE = ARGS.includes("--write");
const FORCE = ARGS.includes("--force");
const SLUGS = (ARGS.find((a) => a.startsWith("--slug=")) || "").split("=")[1]?.split(",").filter(Boolean) || [];
const MAX_IMAGES = 20, MIN_PHOTO_BYTES = 12000, MAX_PHOTO_BYTES = 12 * 1024 * 1024;

function loadEnv() {
  const env = {};
  let raw = "";
  for (const p of [".env.local", "../.env.local", "../../.env.local"]) {
    try { raw = readFileSync(p, "utf8"); if (raw) break; } catch { /* next */ }
  }
  for (const line of raw.split("\n")) {
    const i = line.indexOf("=");
    if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return env;
}

const upsize = (u) => (u.startsWith("//") ? "https:" + u : u).replace(/\/\d{2,4}x\d{1,4}_/, "/1100x0_");
const photoHash = (u) => (u.match(/autohomecar__([A-Za-z0-9]+)/) || u.match(/([A-Za-z0-9]{20,})\.(?:jpe?g|png|webp)/i) || [, u])[1];

async function gallery(seriesId, browser) {
  const ctx = await browser.newContext({ userAgent: UA, locale: "zh-CN", viewport: { width: 1400, height: 2400 } });
  const page = await ctx.newPage();
  try {
    await page.goto(`https://car.autohome.com.cn/pic/series/${seriesId}.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.evaluate(async () => {
      for (let y = 0; y < 14000; y += 900) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 220)); }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);
    const urls = await page.evaluate(() =>
      Array.from(document.querySelectorAll("img")).map((i) => i.getAttribute("data-original") || i.getAttribute("src") || "").filter(Boolean));
    const cardfs = urls.filter((u) => /autoimg\.cn\/.*cardfs/i.test(u)).map(upsize);
    const seen = new Set(), out = [];
    for (const u of cardfs) {
      const h = photoHash(u);
      if (h && seen.has(h)) continue;
      if (h) seen.add(h);
      out.push(u);
      if (out.length >= 30) break;
    }
    return out;
  } catch (e) {
    log.error(`gallery ${seriesId}: ${e.message}`);
    return [];
  } finally { await ctx.close(); }
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
  const mime = sniff(bytes);
  if (!mime) throw new Error("not image");
  return { bytes, mime };
}

async function rehostToDisk(url, mediaUrl, secret) {
  const { bytes, mime } = await fetchPhoto(url);
  const up = await fetch(`${mediaUrl}/api/admin/disk-image?bucket=car-images&dir=autohome`, {
    method: "POST",
    headers: { "content-type": mime, authorization: `Bearer ${secret}` },
    body: bytes,
    signal: AbortSignal.timeout(30000),
  });
  if (!up.ok) throw new Error(`disk ${up.status}`);
  const j = await up.json();
  if (!j.url) throw new Error("disk: no url");
  return j.url;
}

/** Does this stored URL still resolve? Dangling rows are the whole point here. */
async function alive(mediaUrl, url) {
  if (!url) return false;
  if (!url.startsWith("/api/media/")) return true; // external / storage URL — not ours to judge
  try {
    const r = await fetch(`${mediaUrl}${url}`, { method: "GET", headers: { range: "bytes=0-0" }, signal: AbortSignal.timeout(10000) });
    return r.ok || r.status === 206;
  } catch { return false; }
}

async function main() {
  if (SLUGS.length === 0) {
    log.error("pass --slug=<slug>[,<slug>…]");
    process.exit(2);
  }
  const env = loadEnv();
  const mediaUrl = (env.MEDIA_UPLOAD_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
  const secret = env.MEDIA_UPLOAD_SECRET || "";
  if (!secret) { log.error("MEDIA_UPLOAD_SECRET missing — cannot re-host to disk"); process.exit(2); }
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: cars, error } = await sb.from("cars").select("id, slug, thumbnail, images, spec_data").in("slug", SLUGS);
  if (error) { log.error(`query: ${error.message}`); process.exit(1); }
  if (!cars?.length) { log.error(`no cars matched ${SLUGS.join(", ")}`); process.exit(1); }

  let browser = null;
  try {
    for (const car of cars) {
      const seriesId = car.spec_data?.series_id;
      if (!seriesId) { log.warn(`${car.slug}: no spec_data.series_id — skipping`); continue; }

      const stored = [car.thumbnail, ...(car.images || [])].filter(Boolean);
      const checks = await Promise.all(stored.map((u) => alive(mediaUrl, u)));
      const missing = stored.filter((_, i) => !checks[i]);
      log.info(`${car.slug}: ${stored.length} stored, ${missing.length} missing`);
      if (missing.length === 0 && !FORCE) { log.info(`${car.slug}: nothing to repair`); continue; }

      browser ||= await openBrowser();
      const urls = await gallery(seriesId, browser);
      log.info(`${car.slug}: scraped ${urls.length} source photo(s) from series ${seriesId}`);
      if (urls.length === 0) { log.warn(`${car.slug}: gallery empty — leaving the row alone`); continue; }

      const rehosted = [];
      for (const u of urls) {
        if (rehosted.length >= MAX_IMAGES) break;
        if (!WRITE) { rehosted.push("(dry-run)"); continue; }
        try { rehosted.push(await rehostToDisk(u, mediaUrl, secret)); }
        catch (e) { log.warn(`${car.slug}: photo skipped (${e.message})`); }
      }
      log.info(`${car.slug}: ${WRITE ? "re-hosted" : "would re-host"} ${rehosted.length} photo(s)`);

      if (!WRITE) continue;
      if (rehosted.length === 0) { log.warn(`${car.slug}: no photo survived — row untouched`); continue; }
      const { error: upErr } = await sb.from("cars").update({ images: rehosted, thumbnail: rehosted[0] }).eq("id", car.id);
      if (upErr) log.error(`${car.slug}: update failed — ${upErr.message}`);
      else log.info(`${car.slug}: images[] + thumbnail rewritten`);
    }
  } finally {
    if (browser) await browser.close();
  }
}

main().catch((e) => { log.error(e.message); process.exit(1); });
