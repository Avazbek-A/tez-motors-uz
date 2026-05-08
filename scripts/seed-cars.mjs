#!/usr/bin/env node
/**
 * Seed `cars` table with realistic demo inventory.
 *
 * Usage: node scripts/seed-cars.mjs
 *
 * Reads `.env.production` for SUPABASE_URL + SERVICE_ROLE key, parses
 * `scripts/seed/cars.json`, upserts on `slug` so re-running updates
 * rather than duplicates. Each row is tagged via the `notes` of its
 * description so the dealer can spot seeded entries.
 *
 * IMPORTANT: this writes to PRODUCTION Supabase. Re-running is safe
 * (idempotent on slug) but treat with the care of any service-role op.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

async function loadEnv() {
  const text = await readFile(resolve(ROOT, ".env.production"), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return env;
}

function priceUzs(usd) {
  // Approx 12,600 UZS per USD as of 2026 — adjust as needed.
  return Math.round(usd * 12600);
}

async function main() {
  const env = await loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.production");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const carsJson = await readFile(resolve(ROOT, "scripts/seed/cars.json"), "utf8");
  const cars = JSON.parse(carsJson);

  let inserted = 0;
  let updated = 0;
  const errors = [];

  for (let i = 0; i < cars.length; i += 1) {
    const c = cars[i];
    const row = {
      slug: c.slug,
      brand: c.brand,
      model: c.model,
      year: c.year,
      price_usd: c.price_usd,
      original_price_usd: c.original_price_usd ?? null,
      price_uzs: priceUzs(c.price_usd),
      body_type: c.body_type,
      fuel_type: c.fuel_type,
      engine_volume: c.engine_volume,
      engine_power: c.engine_power,
      transmission: c.transmission,
      drivetrain: c.drivetrain,
      mileage: c.mileage ?? 0,
      color: c.color ?? null,
      description_ru: c.description_ru ?? null,
      description_uz: c.description_uz ?? null,
      description_en: c.description_en ?? null,
      images: c.images ?? [],
      thumbnail: (c.images && c.images[0]) || null,
      is_hot_offer: !!c.is_hot_offer,
      is_available: true,
      inventory_status: "available",
      order_position: i,
      specs: c.specs || {},
    };

    // Upsert on slug
    const { data: existing } = await supabase
      .from("cars")
      .select("id")
      .eq("slug", c.slug)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase.from("cars").update(row).eq("id", existing.id);
      if (error) errors.push({ slug: c.slug, message: error.message });
      else updated += 1;
    } else {
      const { error } = await supabase.from("cars").insert(row);
      if (error) errors.push({ slug: c.slug, message: error.message });
      else inserted += 1;
    }
  }

  console.log(`Seed complete: ${inserted} inserted, ${updated} updated, ${errors.length} errors`);
  if (errors.length > 0) {
    console.error(JSON.stringify(errors, null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
