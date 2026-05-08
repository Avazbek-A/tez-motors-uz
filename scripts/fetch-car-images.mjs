#!/usr/bin/env node
/**
 * Pull CC-licensed photos for every seeded car from Wikimedia Commons
 * via the Wikipedia REST summary API, then upsert the URLs into the
 * `cars.images[]` and `cars.thumbnail` columns.
 *
 * Why Wikipedia: every model with a Wikipedia article carries a
 * featured image from Wikimedia Commons, which is CC0/CC-BY and
 * hot-linkable. Manufacturer press kits would be cleaner but require
 * dealer-email access; this is the best we can do without it.
 *
 * Failures are reported but non-fatal — cars without a hit keep their
 * empty images[] (CarCard has a graceful fallback now).
 *
 * Usage: node scripts/fetch-car-images.mjs
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// car slug → Wikipedia article title. Multiple slugs can share an
// article (e.g. all BYD Song Plus year/trim variants).
const SLUG_TO_ARTICLE = {
  "byd-song-plus-dmi-2024": "BYD_Song",
  "byd-song-plus-flagship-2023": "BYD_Song",
  "byd-seal-awd-2024": "BYD_Seal",
  "byd-atto-3-2024": "BYD_Atto_3",
  "byd-han-ev-2024": "BYD_Han",
  "byd-yuan-plus-2024": "BYD_Atto_3",
  "byd-dolphin-2024": "BYD_Dolphin",
  "byd-tang-ev-2024": "BYD_Tang",
  "chery-tiggo-8-pro-max-2024": "Chery_Tiggo_8",
  "chery-tiggo-7-pro-2024": "Chery_Tiggo_7",
  "chery-tiggo-7-pro-luxury-2023": "Chery_Tiggo_7",
  "chery-arrizo-8-2024": "Chery_Arrizo_8",
  "chery-tiggo-4-pro-2024": "Chery_Tiggo_4",
  "chery-tiggo-9-2024": "Chery_Tiggo_9",
  "haval-jolion-2024": "Haval_Jolion",
  "haval-h6-hev-2024": "Haval_H6",
  "haval-h6-2023": "Haval_H6",
  "haval-dargo-2024": "Haval_Dargo",
  "haval-h9-2024": "Haval_H9",
  "geely-coolray-2024": "Geely_Coolray",
  "geely-monjaro-2024": "Geely_Monjaro",
  "geely-atlas-pro-2024": "Geely_Atlas",
  "geely-tugella-2024": "Geely_Tugella",
  "changan-cs75-plus-2024": "Changan_CS75_Plus",
  "changan-uni-t-2024": "Changan_UNI-T",
  "changan-eado-plus-2024": "Changan_Eado",
  "tank-300-2024": "Tank_300",
  "tank-500-2024": "Tank_500",
  "gwm-poer-2024": "Great_Wall_Cannon",
  "mg-hs-2024": "MG_HS",
  "mg-zs-ev-2024": "MG_ZS_EV",
  "omoda-c5-2024": "Omoda_C5",
  "omoda-5-gt-2024": "Omoda_5",
  "jaecoo-j7-2024": "Jaecoo_J7",
  "jaecoo-j8-2024": "Jaecoo_J8",
};

async function loadEnv() {
  const text = await readFile(resolve(ROOT, ".env.production"), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return env;
}

async function fetchArticleImage(article) {
  // Wikipedia REST summary endpoint returns thumbnail + originalimage.
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${article}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "tez-motors-seed/1.0 (https://tezmotors.uz)" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.originalimage?.source ?? data?.thumbnail?.source ?? null;
}

async function fetchAdditionalImages(article) {
  // Pull a few more images from the article via the media-list endpoint
  // so each car has 2-4 photos — enough for the gallery to feel real.
  // Filter out small icons and SVGs.
  const url = `https://en.wikipedia.org/api/rest_v1/page/media-list/${article}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "tez-motors-seed/1.0 (https://tezmotors.uz)" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items = (data?.items ?? [])
      .filter((it) => it.type === "image" && it.srcset && it.srcset.length > 0)
      .map((it) => {
        // Pick the largest src in the srcset.
        const largest = it.srcset.reduce((acc, cur) =>
          parseFloat(cur.scale ?? "1") > parseFloat(acc.scale ?? "1") ? cur : acc
        );
        const src = largest.src.startsWith("//") ? `https:${largest.src}` : largest.src;
        return src;
      })
      .filter((src) =>
        src.includes("upload.wikimedia.org") &&
        !src.endsWith(".svg") &&
        !src.includes("Commons-logo") &&
        !src.includes("Wikipedia") &&
        !src.includes("Question_book")
      );
    // Dedupe by filename.
    const seen = new Set();
    return items.filter((s) => {
      const file = s.split("/").pop();
      if (seen.has(file)) return false;
      seen.add(file);
      return true;
    });
  } catch {
    return [];
  }
}

async function main() {
  const env = await loadEnv();
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  // Cache so we only hit Wikipedia once per article even if multiple
  // car slugs share it.
  const articleCache = new Map();

  let updated = 0;
  let skipped = 0;
  const failed = [];

  for (const [slug, article] of Object.entries(SLUG_TO_ARTICLE)) {
    let images;
    if (articleCache.has(article)) {
      images = articleCache.get(article);
    } else {
      const main = await fetchArticleImage(article);
      const more = await fetchAdditionalImages(article);
      // Put the page-level featured image first, then dedupe.
      const seen = new Set();
      const combined = [];
      for (const url of [main, ...more].filter(Boolean)) {
        const file = url.split("/").pop();
        if (seen.has(file)) continue;
        seen.add(file);
        combined.push(url);
      }
      // Cap at 4 — gallery doesn't need more.
      images = combined.slice(0, 4);
      articleCache.set(article, images);
    }

    if (!images || images.length === 0) {
      failed.push({ slug, article });
      skipped += 1;
      continue;
    }

    const { error } = await supabase
      .from("cars")
      .update({ images, thumbnail: images[0] })
      .eq("slug", slug);
    if (error) {
      failed.push({ slug, article, message: error.message });
      skipped += 1;
    } else {
      updated += 1;
      console.log(`✓ ${slug} (${images.length} imgs)`);
    }
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped`);
  if (failed.length > 0) {
    console.log("Failures (no Wikipedia hit):");
    for (const f of failed) console.log(`  - ${f.slug} → ${f.article}${f.message ? `: ${f.message}` : ""}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
