/**
 * Eliminate low-quality car-catalog photos sourced from news/Wikimedia, now that
 * cars carry high-quality AutoHome manufacturer photos.
 *
 * Image provenance is encoded in the Storage path:
 *   car-images/autohome/{seriesId}-… → AutoHome manufacturer photos  (KEEP)
 *   car-images/{slug}/…              → old Wikipedia/Wikimedia/news batch
 *   external upload.wikimedia.org/…  → un-mirrored Wikimedia           (drop if low-q)
 *
 * Rules (never leave a car with zero images):
 *   - Car HAS AutoHome photos  → keep AutoHome only, drop the whole old batch.
 *   - Car has NO AutoHome photos → measure each old image; drop ones below the
 *     quality bar (longest edge < MINEDGE px OR < MINBYTES); if that would empty
 *     the car, keep the single highest-resolution image.
 * Thumbnail is repointed to the first surviving image when it was dropped.
 *
 *   node scripts/clean-car-images.mjs --dry   # report what would change
 *   node scripts/clean-car-images.mjs         # apply
 *   MINEDGE=800 MINBYTES=25000 node scripts/clean-car-images.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry");
const MINEDGE = Number(process.env.MINEDGE || 800);
const MINBYTES = Number(process.env.MINBYTES || 25_000);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function loadEnv() {
  const env = {};
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return env;
}

const isAutohome = (u) => /\/car-images\/autohome\//.test(u);

/** Read pixel dimensions from JPEG/PNG/WebP bytes. Returns {w,h} or null. */
function imageDims(b) {
  // PNG
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { w: (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19], h: (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23] };
  }
  // JPEG
  if (b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o < b.length) {
      if (b[o] !== 0xff) { o++; continue; }
      const marker = b[o + 1];
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { o += 2; continue; }
      const len = (b[o + 2] << 8) | b[o + 3];
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return { h: (b[o + 5] << 8) | b[o + 6], w: (b[o + 7] << 8) | b[o + 8] };
      }
      o += 2 + len;
    }
  }
  // WebP
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) {
    const fmt = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (fmt === "VP8X") return { w: 1 + ((b[24]) | (b[25] << 8) | (b[26] << 16)), h: 1 + ((b[27]) | (b[28] << 8) | (b[29] << 16)) };
    if (fmt === "VP8 ") return { w: ((b[26] | (b[27] << 8)) & 0x3fff), h: ((b[28] | (b[29] << 8)) & 0x3fff) };
    if (fmt === "VP8L") { const n = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24); return { w: 1 + (n & 0x3fff), h: 1 + ((n >> 14) & 0x3fff) }; }
  }
  return null;
}

async function measure(url) {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "image/*" }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return { ok: false, bytes: 0, edge: 0 };
    const b = new Uint8Array(await r.arrayBuffer());
    const d = imageDims(b);
    const edge = d ? Math.max(d.w || 0, d.h || 0) : 0;
    return { ok: true, bytes: b.byteLength, edge, dims: d };
  } catch {
    return { ok: false, bytes: 0, edge: 0 };
  }
}

async function main() {
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: cars, error } = await sb.from("cars").select("id,brand,model,images,thumbnail");
  if (error) throw error;

  const stats = { carsChanged: 0, dropped: 0, kept: 0, emptyGuard: 0 };

  for (const car of cars) {
    const imgs = Array.isArray(car.images) ? car.images : [];
    if (!imgs.length) continue;
    const autohome = imgs.filter(isAutohome);
    const old = imgs.filter((u) => !isAutohome(u));

    let keep;
    let droppedList = [];

    if (autohome.length > 0) {
      // High-quality manufacturer photos exist → keep only those.
      keep = autohome;
      droppedList = old;
    } else {
      // No AutoHome photos: quality-filter the old batch, never go empty.
      const measured = [];
      for (const u of old) measured.push({ u, ...(await measure(u)) });
      const good = measured.filter((m) => m.ok && m.edge >= MINEDGE && m.bytes >= MINBYTES);
      if (good.length > 0) {
        keep = good.sort((a, b) => b.edge - a.edge).map((m) => m.u);
        droppedList = measured.filter((m) => !good.includes(m)).map((m) => m.u);
      } else {
        // All low quality — keep the single best so the card isn't empty.
        const best = measured.filter((m) => m.ok).sort((a, b) => b.edge - a.edge || b.bytes - a.bytes)[0];
        keep = best ? [best.u] : old.slice(0, 1);
        droppedList = old.filter((u) => u !== keep[0]);
        stats.emptyGuard++;
      }
    }

    keep = [...new Set(keep)].slice(0, 14);
    const changed = keep.length !== imgs.length || keep.some((u, i) => u !== imgs[i]);
    if (!changed) continue;

    stats.carsChanged++;
    stats.dropped += droppedList.length;
    stats.kept += keep.length;
    const newThumb = car.thumbnail && keep.includes(car.thumbnail) ? car.thumbnail : keep[0];
    const tag = autohome.length ? "autohome" : "quality-filtered";
    console.log(`${car.brand} ${car.model}: ${imgs.length} → ${keep.length} (${tag}, dropped ${droppedList.length})`);

    if (!DRY) {
      const { error: upErr } = await sb.from("cars").update({ images: keep, thumbnail: newThumb }).eq("id", car.id);
      if (upErr) console.log(`  ! update failed: ${upErr.message}`);
    }
  }

  console.log(`\n── ${DRY ? "dry run" : "done"} ──`);
  console.log(`cars changed: ${stats.carsChanged} | images dropped: ${stats.dropped} | kept: ${stats.kept} | low-q kept (empty-guard): ${stats.emptyGuard}`);
}

main().catch((e) => { console.error(e?.stack || String(e)); process.exit(1); });
