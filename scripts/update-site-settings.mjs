#!/usr/bin/env node
/**
 * Push real Tez Motors business info into the site_settings singleton.
 *
 * Source: public Instagram bio (@tezmotors_uz) cross-referenced with
 * Telegram channel (@tezmotors). Email + working hours are still
 * placeholders and need verification from the dealer.
 *
 * Re-runnable; service-role credentials read from .env.production.
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

const VALUES = {
  siteName: "Tez Motors",
  phone: "+998 90 908 70 13",
  phoneRaw: "+998909087013",
  email: "tezglobalmotors@gmail.com",
  address: "г. Ташкент, Чиланзарский район, ул. Катартал, 25",
  workingHours: "Пн-Сб: 09:00 – 19:00",
  telegram: "https://t.me/tezmotors",
  instagram: "https://instagram.com/tezmotors_uz",
  whatsapp: "https://wa.me/998909087013",
};

async function main() {
  const env = await loadEnv();
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  const { error } = await supabase
    .from("site_settings")
    .upsert(
      { id: "singleton", values: VALUES, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );

  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log("site_settings updated:", VALUES);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
