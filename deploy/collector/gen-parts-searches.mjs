/**
 * Generate a comprehensive OLX parts-search matrix for olx-parts-crawlee.mjs.
 *
 * Covers the cars Uzbekistan actually drives (Chevrolet/Daewoo/Ravon dominate the
 * used market) PLUS the Chinese brands Tez Motors imports — crossed with the
 * highest-demand part keywords per category. Each search carries category + brand +
 * fitment so the collector pre-tags fits_brands/fits_models (cheap, no LLM).
 *
 * Run: node gen-parts-searches.mjs            (→ ./olx-parts-searches.json)
 * Then: OLX_PARTS_SEARCHES_FILE=./olx-parts-searches.json node olx-parts-crawlee.mjs
 */
import { writeFileSync } from "node:fs";

// category → the RU keywords buyers actually search. CORE = tight top-demand set used
// per model (keeps the run focused); BROAD = wider set used for the brand-level searches.
// Expand these to scale the catalogue in later runs.
const CORE = {
  engine: ["масляный фильтр", "воздушный фильтр", "салонный фильтр", "свечи зажигания", "ремень грм"],
  brakes: ["тормозные колодки", "тормозные диски"],
  suspension: ["амортизатор", "шаровая опора", "ступичный подшипник"],
  electrical: ["аккумулятор", "стартер", "генератор", "фара"],
  body: ["бампер", "капот", "зеркало боковое"],
};
const BROAD = {
  ...CORE,
  suspension: ["амортизатор", "шаровая опора", "ступичный подшипник", "рычаг", "стойка стабилизатора"],
  electrical: ["аккумулятор", "стартер", "генератор", "фара", "катушка зажигания"],
  body: ["бампер", "капот", "крыло", "зеркало боковое", "решётка радиатора"],
  interior: ["коврики салона", "чехлы сидений"],
  other: ["щётки стеклоочистителя", "шрус", "пыльник шруса"],
};

// Popular UZ cars → fitment. (brand + specific models for the high-volume ones.)
const MODELS = [
  { brand: "Chevrolet", models: ["Cobalt", "Nexia", "Spark", "Lacetti", "Gentra", "Malibu", "Captiva", "Tracker", "Onix", "Damas", "Equinox"] },
  { brand: "Ravon", models: ["R2", "R3", "R4", "Gentra", "Nexia"] },
  { brand: "Daewoo", models: ["Matiz", "Nexia", "Lacetti", "Damas"] },
];
// Chinese brands Tez Motors sells + other popular UZ brands — brand-level searches.
const CN_BRANDS = ["BYD", "Chery", "Changan", "Haval", "Geely", "JETOUR", "Exeed", "Kia", "Hyundai", "Toyota", "Nissan", "Lada"];

const searches = [];
const seen = new Set();
const add = (q, category, brand, fits_brands, fits_models) => {
  const key = q.toLowerCase().trim();
  if (seen.has(key)) return;
  seen.add(key);
  searches.push({ q, category, brand, fits_brands, ...(fits_models ? { fits_models } : {}) });
};

// Model-level: top keywords × each popular model.
for (const { brand, models } of MODELS) {
  for (const model of models) {
    for (const [category, kws] of Object.entries(CORE)) {
      for (const kw of kws) add(`${kw} ${brand} ${model}`, category, brand, [brand], [model]);
    }
  }
}
// Brand-level: broader keyword set × each Chinese brand.
for (const brand of CN_BRANDS) {
  for (const [category, kws] of Object.entries(BROAD)) {
    for (const kw of kws) add(`${kw} ${brand}`, category, brand, [brand]);
  }
}

writeFileSync("./olx-parts-searches.json", JSON.stringify(searches, null, 1));
console.log(`wrote ${searches.length} searches → ./olx-parts-searches.json`);
console.log(`  models: ${MODELS.flatMap((m) => m.models).length} × core kw + ${CN_BRANDS.length} CN brands × broad kw`);
