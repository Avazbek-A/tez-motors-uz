/**
 * Seed the pre-order model_catalog — the "menu" of cars the dealer can import to
 * order. Without this, the /order funnel (linked from the catalog zero-results
 * state and every car detail page) is an empty dead-end. Service-role; reads
 * .env.production. Idempotent: upserts on the unique slug.
 *
 *   node scripts/seed-models.mjs
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

const slug = (b, m) => `${b}-${m}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Curated menu of importable configurations across the brands the dealer moves.
// base_price_usd is an indicative "from" price; trims/colors give the configurator options.
const MODELS = [
  { brand: "BYD", model: "Song Plus DM-i", body: "suv", fuel: "hybrid", year: 2024, price: 23500, trims: ["Standard", "Flagship"], colors: ["White", "Black", "Grey", "Blue"], lead: [6, 8] },
  { brand: "BYD", model: "Seal", body: "sedan", fuel: "electric", year: 2024, price: 29500, trims: ["Dynamic", "Premium", "AWD"], colors: ["White", "Black", "Grey", "Green"], lead: [7, 9] },
  { brand: "BYD", model: "Atto 3", body: "suv", fuel: "electric", year: 2024, price: 26500, trims: ["Comfort", "Design"], colors: ["White", "Blue", "Red", "Grey"], lead: [6, 8] },
  { brand: "BYD", model: "Han EV", body: "sedan", fuel: "electric", year: 2024, price: 38500, trims: ["Premium", "AWD Performance"], colors: ["Black", "White", "Blue"], lead: [8, 10] },
  { brand: "Chery", model: "Tiggo 8 Pro Max", body: "suv", fuel: "petrol", year: 2024, price: 27500, trims: ["Luxury", "Flagship"], colors: ["White", "Black", "Grey"], lead: [6, 8] },
  { brand: "Chery", model: "Tiggo 7 Pro", body: "suv", fuel: "petrol", year: 2024, price: 21500, trims: ["Comfort", "Luxury"], colors: ["White", "Black", "Silver", "Blue"], lead: [6, 8] },
  { brand: "Chery", model: "Arrizo 8", body: "sedan", fuel: "petrol", year: 2024, price: 19900, trims: ["Comfort", "Premium"], colors: ["White", "Black", "Grey"], lead: [6, 8] },
  { brand: "Haval", model: "Jolion", body: "suv", fuel: "hybrid", year: 2024, price: 20500, trims: ["Comfort", "Premium", "Supreme"], colors: ["White", "Red", "Black", "Blue"], lead: [6, 8] },
  { brand: "Haval", model: "H6", body: "suv", fuel: "hybrid", year: 2024, price: 25500, trims: ["Elite", "Premium"], colors: ["White", "Grey", "Black"], lead: [7, 9] },
  { brand: "Geely", model: "Monjaro", body: "suv", fuel: "petrol", year: 2024, price: 33500, trims: ["Flagship", "Flagship AWD"], colors: ["White", "Black", "Green", "Grey"], lead: [8, 10] },
  { brand: "Geely", model: "Coolray", body: "suv", fuel: "petrol", year: 2024, price: 18900, trims: ["Comfort", "Flagship"], colors: ["White", "Red", "Black", "Blue"], lead: [6, 8] },
  { brand: "Zeekr", model: "001", body: "sedan", fuel: "electric", year: 2024, price: 45000, trims: ["WE", "YOU", "Performance AWD"], colors: ["White", "Grey", "Blue", "Green"], lead: [9, 12] },
  { brand: "Changan", model: "CS75 Plus", body: "suv", fuel: "petrol", year: 2024, price: 22500, trims: ["Comfort", "Flagship"], colors: ["White", "Black", "Grey"], lead: [6, 8] },
  { brand: "Tank", model: "300", body: "suv", fuel: "petrol", year: 2024, price: 39500, trims: ["Adventure", "Off-road"], colors: ["White", "Black", "Green", "Sand"], lead: [9, 11] },
  { brand: "Omoda", model: "C5", body: "suv", fuel: "petrol", year: 2024, price: 19500, trims: ["Comfort", "Premium"], colors: ["White", "Black", "Blue", "Grey"], lead: [6, 8] },
];

const rows = MODELS.map((m, i) => {
  const name = `${m.brand} ${m.model}`;
  const colorsRu = m.colors.length;
  return {
    slug: slug(m.brand, m.model),
    brand: m.brand,
    model: m.model,
    trims: m.trims,
    body_type: m.body,
    fuel_type: m.fuel,
    year: m.year,
    base_price_usd: m.price,
    lead_time_weeks_min: m.lead[0],
    lead_time_weeks_max: m.lead[1],
    available_colors: m.colors,
    is_orderable: true,
    order_position: i,
    description_ru: `${name} ${m.year} — импорт под заказ из Китая. ${m.trims.length} комплектаций, ${colorsRu} цветов на выбор. Срок поставки «под ключ» ${m.lead[0]}–${m.lead[1]} недель: подбор, доставка, таможня и гарантия от Tez Motors.`,
    description_uz: `${name} ${m.year} — Xitoydan buyurtma asosida import. ${m.trims.length} ta komplektatsiya, ${colorsRu} ta rang. «Kalit topshirish» yetkazib berish muddati ${m.lead[0]}–${m.lead[1]} hafta: tanlov, yetkazish, bojxona va Tez Motors kafolati.`,
    description_en: `${name} ${m.year} — imported to order from China. ${m.trims.length} trims and ${colorsRu} colours to choose from. Turn-key lead time ${m.lead[0]}–${m.lead[1]} weeks: sourcing, shipping, customs and warranty by Tez Motors.`,
  };
});

const { data, error } = await supabase.from("model_catalog").upsert(rows, { onConflict: "slug" }).select("id");
if (error) {
  console.log(`✗ seed-models failed: ${error.message}`);
  process.exit(1);
}
console.log(`✓ Seeded ${data?.length ?? rows.length} orderable models into model_catalog.`);
