/**
 * Fill photos for every car that has an empty images[] by searching Wikimedia
 * (CC-licensed) — generalizes scripts/fetch-car-images.mjs beyond its hardcoded
 * slug→article map. Stores the Wikimedia URLs; run scripts/mirror-car-images.mjs
 * afterwards to re-host them onto your own Storage bucket. Service-role; reads
 * .env.production. Idempotent: skips cars that already have images.
 *
 *   node scripts/fill-missing-car-photos.mjs
 *   node scripts/mirror-car-images.mjs   # then re-host to car-images bucket
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const line of (await readFile(resolve(ROOT, ".env.production"), "utf8")).split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const UA = "tez-motors-seed/1.0 (https://tezmotors.uz)";
const WIKI = "https://en.wikipedia.org";
const MAX_PER_CAR = 5;

const usable = (src) => {
  if (!src.includes("upload.wikimedia.org") || src.endsWith(".svg")) return false;
  // Logo/icon patterns match the FILENAME only — the URL path always contains
  // "/wikipedia/commons/", which must not trip the "Wikipedia" filter.
  const file = src.split("/").pop() ?? "";
  return !/Commons-logo|Wikipedia|Question_book|Edit-clear|Ambox|Crystal_|_icon\./i.test(file);
};

async function wiki(path) {
  try {
    const res = await fetch(`${WIKI}${path}`, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function findImages(brand, model) {
  const search = await wiki(`/w/rest.php/v1/search/page?q=${encodeURIComponent(`${brand} ${model}`)}&limit=3`);
  const key = search?.pages?.[0]?.key;
  if (!key) return [];
  const urls = [];
  const summary = await wiki(`/api/rest_v1/page/summary/${encodeURIComponent(key)}`);
  const hero = summary?.originalimage?.source ?? summary?.thumbnail?.source;
  if (hero && usable(hero)) urls.push(hero);
  const media = await wiki(`/api/rest_v1/page/media-list/${encodeURIComponent(key)}`);
  for (const it of media?.items ?? []) {
    if (it.type !== "image" || !it.srcset?.length) continue;
    const largest = it.srcset.reduce((a, c) => (parseFloat(c.scale ?? "1") > parseFloat(a.scale ?? "1") ? c : a));
    const src = largest.src.startsWith("//") ? `https:${largest.src}` : largest.src;
    if (usable(src)) urls.push(src);
  }
  const seen = new Set();
  return urls.filter((u) => { const f = (u.split("/").pop() ?? u).replace(/^\d+px-/, ""); if (seen.has(f)) return false; seen.add(f); return true; }).slice(0, MAX_PER_CAR);
}

const { data: cars, error } = await supabase
  .from("cars")
  .select("id, brand, model, images")
  .or("images.is.null,images.eq.{}");
if (error) { console.log(`✗ query failed: ${error.message}`); process.exit(1); }

const missing = (cars ?? []).filter((c) => !Array.isArray(c.images) || c.images.length === 0);
console.log(`Cars with no photos: ${missing.length}`);

let filled = 0;
for (const car of missing) {
  const imgs = await findImages(car.brand, car.model);
  if (imgs.length === 0) { console.log(`  · ${car.brand} ${car.model}: no Wikimedia match`); continue; }
  const { error: upErr } = await supabase.from("cars").update({ images: imgs, thumbnail: imgs[0] }).eq("id", car.id);
  if (upErr) { console.log(`  ✗ ${car.brand} ${car.model}: ${upErr.message}`); continue; }
  filled += 1;
  console.log(`  ✓ ${car.brand} ${car.model}: ${imgs.length} image(s)`);
}
console.log(`\nFilled ${filled}/${missing.length} cars. Now run: node scripts/mirror-car-images.mjs`);
