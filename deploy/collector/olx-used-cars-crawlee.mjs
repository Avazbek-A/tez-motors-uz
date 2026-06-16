/**
 * OLX (olx.uz) used-CAR crawler — feeds the `/used` classifieds section.
 *
 * Scopes to OLX category 983 (cars), runs the brand+model search matrix from
 * gen-used-car-searches.mjs, and extracts the structured car params OLX exposes
 * (year, mileage, transmission, fuel, body, colour, owners) plus up to 8 photos.
 * Emits olx-used-cars.json for import-used-cars.mjs, which rehosts the photos and
 * inserts the rows as cars(listing_type='used'). Proxy-free OLX public JSON API.
 *
 * These are THIRD-PARTY market listings, not Tez inventory — the importer stamps a
 * provenance note + source URL and `/used` is worded as an aggregator (not
 * "inspected Tez cars"). Run gently; respect OLX ToS.
 *
 * Setup (on the Vostro):
 *   cd deploy/collector
 *   node gen-used-car-searches.mjs
 *   OLX_USED_SEARCHES_FILE=./olx-used-searches.json node olx-used-cars-crawlee.mjs
 */
import { writeFileSync } from "node:fs";
import { HttpCrawler, Configuration } from "crawlee";
import { UA, baseCrawlerOptions, loadJsonOrDefault, log } from "./crawlee-shared.mjs";

Configuration.getGlobalConfig().set("persistStorage", false);

const API = "https://www.olx.uz/api/v1/offers/";
const OUT = process.env.OLX_USED_OUT || "./olx-used-cars.json";
const PER_SEARCH = Number(process.env.OLX_USED_PER_SEARCH || 24);
const USD_UZS = Number(process.env.USD_UZS || 12600);
const OLX_CAR_CATEGORY = process.env.OLX_CAR_CATEGORY || "983"; // OLX "Легковые автомобили"
const MAX_PHOTOS = Number(process.env.OLX_USED_MAX_PHOTOS || 8);

const DEFAULT_SEARCHES = [
  { q: "Chevrolet Cobalt", brand: "Chevrolet", model: "Cobalt" },
  { q: "Chevrolet Nexia", brand: "Chevrolet", model: "Nexia" },
  { q: "Chevrolet Spark", brand: "Chevrolet", model: "Spark" },
];

const TRANSMISSION = { "автоматическая": "automatic", "механическая": "manual", "робот": "robot", "роботизированная": "robot", "вариатор": "cvt" };
const FUEL = { "бензин": "petrol", "газ/бензин": "petrol", "газ": "petrol", "метан": "petrol", "пропан": "petrol", "дизель": "diesel", "электро": "electric", "гибрид": "hybrid" };
const BODY = { "седан": "sedan", "хэтчбек": "hatchback", "хетчбек": "hatchback", "внедорожник": "suv", "кроссовер": "suv", "универсал": "wagon", "минивэн": "minivan", "купе": "coupe", "пикап": "pickup", "лифтбек": "hatchback" };

function slugify(input) {
  return input.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}
const TRANSLIT = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
const translit = (s) => s.toLowerCase().split("").map((ch) => TRANSLIT[ch] ?? ch).join("");

function paramMap(offer) {
  const m = {};
  for (const p of offer?.params || []) {
    const v = p?.value;
    m[p.key] = v && typeof v === "object" ? (v.label ?? v.key ?? v.value) : v;
  }
  return m;
}
function offerPrice(offer) {
  const pp = (offer?.params || []).find((p) => p?.key === "price" || p?.type === "price");
  const pv = pp?.value;
  if (!pv || typeof pv !== "object" || typeof pv.value !== "number") return null;
  const cur = String(pv.currency || "").toUpperCase();
  // UZ cars are quoted in у.е. (UYE) ≈ USD 1:1 — use that value directly. Only true
  // сум (UZS) prices get divided by the FX rate. (Mis-handling UYE made every
  // dollar-priced car collapse to ~$1.)
  if (cur === "USD" || cur === "UYE") return pv.value;
  return pv.value / USD_UZS;
}
const digits = (s) => { const n = parseInt(String(s ?? "").replace(/[^\d]/g, ""), 10); return Number.isFinite(n) ? n : null; };
function photoUrls(offer) {
  return (offer?.photos || []).slice(0, MAX_PHOTOS)
    .map((p) => (p?.link || "").replace("{width}x{height}", "1000x1000"))
    .filter((u) => /^https?:\/\//.test(u));
}

async function main() {
  const searches = loadJsonOrDefault("OLX_USED_SEARCHES_FILE", DEFAULT_SEARCHES).filter((s) => s && s.q && s.brand && s.model);
  if (!searches.length) { log.error("no valid searches (need { q, brand, model })"); process.exit(1); }

  const rows = [];
  const seenSlugs = new Set();

  const crawler = new HttpCrawler({
    ...baseCrawlerOptions({ maxConcurrency: 2 }),
    additionalMimeTypes: ["application/json"],
    preNavigationHooks: [async ({ request }) => { request.headers = { ...request.headers, "user-agent": UA, accept: "application/json", "accept-language": "ru,en;q=0.8" }; }],
    async requestHandler({ request, body, json, session }) {
      const s = request.userData.search;
      const data = json || JSON.parse(body.toString());
      const offers = Array.isArray(data?.data) ? data.data : [];
      if (offers.length === 0 && session) session.markBad();

      let n = 0;
      for (const o of offers.slice(0, PER_SEARCH)) {
        const title = (o?.title || "").trim().slice(0, 200);
        const pm = paramMap(o);
        const year = digits(pm.motor_year);
        const priceRaw = offerPrice(o);
        const price = priceRaw != null && priceRaw > 0 ? Math.round(priceRaw) : null;
        const photos = photoUrls(o);
        // Hard requirements for a car row: title, plausible year, price, ≥1 photo.
        if (!title || !year || year < 1980 || year > 2027 || !price || photos.length === 0) continue;

        let base = slugify(`${s.brand}-${s.model}-${year}-${translit(title)}`) || `olx-car-${o.id || n}`;
        let slug = base; let k = 2;
        while (seenSlugs.has(slug)) slug = `${base}-${k++}`;
        seenSlugs.add(slug);

        const tr = TRANSMISSION[String(pm.transmission_type || "").toLowerCase()] || null;
        const fu = FUEL[String(pm.fuel_type || "").toLowerCase()] || null;
        const bo = BODY[String(pm.car_body || "").toLowerCase()] || null;

        rows.push({
          slug,
          brand: s.brand,
          model: pm.model || s.model,
          year,
          price_usd: price,
          mileage: digits(pm.motor_mileage),
          transmission: tr,
          fuel_type: fu,
          body_type: bo,
          color: pm.color || null,
          owners_count: digits(pm.owners),
          condition_grade: /отличн/i.test(String(pm.condition)) ? "excellent" : /хорош/i.test(String(pm.condition)) ? "good" : null,
          title,
          city: o?.location?.city?.name || "",
          url: o?.url || "",
          images: photos,
        });
        n++;
      }
      log.info(`${s.q}: ${n} used cars`);
    },
    failedRequestHandler({ request }) { log.warning(`failed after retries: ${request.userData.search?.q}`); },
  });

  await crawler.run(searches.map((s) => ({
    url: `${API}?offset=0&limit=${Math.min(PER_SEARCH, 40)}&query=${encodeURIComponent(s.q)}&category_id=${OLX_CAR_CATEGORY}`,
    userData: { search: s },
  })));

  if (rows.length === 0) { log.error("0 used cars extracted."); process.exit(2); }
  writeFileSync(OUT, JSON.stringify(rows));
  log.info(`wrote ${rows.length} used-car rows → ${OUT}`);
  log.info("Next: node import-used-cars.mjs --write (rehost photos + insert as cars listing_type='used').");
}
main().catch((e) => { log.error(e?.stack || String(e)); process.exit(1); });
