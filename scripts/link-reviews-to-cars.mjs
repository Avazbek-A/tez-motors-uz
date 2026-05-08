#!/usr/bin/env node
/**
 * After applying migration 015 (adds reviews.car_id column), run this
 * to back-link the seeded reviews to their cars by car_description text
 * match. Safe to re-run — only updates rows whose car_id is currently
 * NULL.
 *
 * Usage: node scripts/link-reviews-to-cars.mjs
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const MAP = {
  "BYD Song Plus DM-i 2024": "byd-song-plus-dmi-2024",
  "Chery Tiggo 8 Pro Max 2024": "chery-tiggo-8-pro-max-2024",
  "Haval Jolion 2024": "haval-jolion-2024",
  "Geely Coolray 2024": "geely-coolray-2024",
  "Tank 300 2024": "tank-300-2024",
  "BYD Atto 3 2024": "byd-atto-3-2024",
  "Changan UNI-T 2024": "changan-uni-t-2024",
  "Haval H6 HEV 2024": "haval-h6-hev-2024",
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

async function main() {
  const env = await loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const slugs = Object.values(MAP);
  const { data: cars } = await supabase.from("cars").select("id, slug").in("slug", slugs);
  const carIdBySlug = Object.fromEntries((cars || []).map((c) => [c.slug, c.id]));

  let updated = 0;
  for (const [carDescription, slug] of Object.entries(MAP)) {
    const carId = carIdBySlug[slug];
    if (!carId) continue;
    const { count, error } = await supabase
      .from("reviews")
      .update({ car_id: carId })
      .eq("car_description", carDescription)
      .is("car_id", null)
      .select("id", { count: "exact", head: true });
    if (error) {
      console.error(`Error linking ${carDescription}:`, error.message);
      continue;
    }
    updated += count ?? 0;
  }
  console.log(`Linked ${updated} reviews to cars.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
