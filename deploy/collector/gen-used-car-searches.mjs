/**
 * Generate the OLX used-CAR search matrix for olx-used-cars-crawlee.mjs.
 *
 * Unlike parts (one OLX category, keyword-driven), used cars live in OLX category
 * 983 and the cleanest signal is the brand+model the buyer types. We drive searches
 * from the cars Uzbekistan actually buys second-hand (Chevrolet/Daewoo/Ravon
 * dominate) PLUS the Chinese brands Tez Motors imports — so `/used` mirrors both the
 * local market and Tez's own line-up. brand+model ride along so the collector never
 * has to guess them from messy OLX titles ("kobalt 2023 kraska toza").
 *
 * Run: node gen-used-car-searches.mjs            (→ ./olx-used-searches.json)
 * Then: OLX_USED_SEARCHES_FILE=./olx-used-searches.json node olx-used-cars-crawlee.mjs
 */
import { writeFileSync } from "node:fs";

// brand → the models that actually trade on the UZ used market / that Tez sells.
const BRANDS = {
  Chevrolet: ["Cobalt", "Nexia", "Spark", "Lacetti", "Gentra", "Malibu", "Captiva", "Tracker", "Onix", "Damas", "Equinox", "Tahoe", "Tracker 2", "Monza"],
  Daewoo: ["Matiz", "Nexia", "Lacetti", "Damas", "Tico", "Gentra"],
  Ravon: ["R2", "R3", "R4", "Gentra", "Nexia"],
  BYD: ["Chazor", "Song Plus", "Han", "Seal", "Yuan Plus", "Dolphin", "Song", "Tang"],
  Chery: ["Tiggo 4", "Tiggo 7", "Tiggo 8", "Arrizo", "Tiggo"],
  Changan: ["CS35", "CS55", "Eado", "UNI-T", "UNI-K", "Alsvin"],
  Haval: ["Jolion", "H6", "Dargo", "F7"],
  Geely: ["Coolray", "Emgrand", "Monjaro", "Atlas", "Tugella"],
  JETOUR: ["X70", "Dashing", "X90"],
  Exeed: ["TXL", "VX", "LX"],
  Kia: ["K5", "Sportage", "Sorento", "Rio", "Cerato"],
  Hyundai: ["Sonata", "Tucson", "Elantra", "Santa Fe", "Accent"],
  Toyota: ["Camry", "Corolla", "RAV4", "Land Cruiser", "Prado"],
  Lada: ["Niva", "Vesta", "Granta", "Largus"],
  Nissan: ["Qashqai", "X-Trail"],
};

const searches = [];
const seen = new Set();
for (const [brand, models] of Object.entries(BRANDS)) {
  for (const model of models) {
    const q = `${brand} ${model}`;
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    searches.push({ q, brand, model });
  }
}

writeFileSync("./olx-used-searches.json", JSON.stringify(searches, null, 1));
console.log(`wrote ${searches.length} used-car searches → ./olx-used-searches.json`);
console.log(`  ${Object.keys(BRANDS).length} brands × their UZ-market models`);
