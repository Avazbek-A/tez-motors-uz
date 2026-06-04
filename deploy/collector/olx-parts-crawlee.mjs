/**
 * OLX (olx.uz) spare-parts crawler — Crawlee edition.
 *
 * Sources spare-parts listings from OLX into a REVIEWABLE DRAFT CSV in the exact
 * shape /api/admin/parts/import reads (rows are is_published=false). Same review-
 * before-publish discipline as the Alibaba crawler — but this one runs on OLX's
 * proven public JSON API, so it works WITHOUT proxies (unlike Alibaba). Use it for
 * local parts sourcing + price discovery; the dealer reviews, translates, sets
 * OEM/fitment, then publishes.
 *
 * Why Crawlee: even API-first, we get managed retries/backoff, a rotating session
 * pool, optional proxy rotation, and bounded concurrency for free.
 *
 * Setup (on the box):
 *   cd deploy/collector && npm install
 *   # optional: searches file = [{ "q":"тормозные колодки byd","category":"brakes","fits_brands":["BYD"] }, …]
 *   export OLX_PARTS_SEARCHES_FILE=./olx-parts-searches.json
 *   export OLX_PARTS_OUT=./olx-parts.csv
 *   export OLX_PARTS_PER_SEARCH=20
 *   export USD_UZS=12600            # UZS→USD conversion for price_usd (admin verifies)
 *   node olx-parts-crawlee.mjs
 * Then: Admin → Parts → Import → upload olx-parts.csv (dry-run first), review, publish.
 *
 * Respect OLX ToS/robots; run gently. Verify product/price/image rights before publishing.
 */
import { HttpCrawler, Configuration } from "crawlee";
import { UA, baseCrawlerOptions, writeCsv, loadJsonOrDefault, log } from "./crawlee-shared.mjs";

Configuration.getGlobalConfig().set("persistStorage", false);

const API = "https://www.olx.uz/api/v1/offers/";
const OUT = process.env.OLX_PARTS_OUT || "./olx-parts.csv";
const PER_SEARCH = Number(process.env.OLX_PARTS_PER_SEARCH || 20);
const USD_UZS = Number(process.env.USD_UZS || 12600);

const PART_CATEGORIES = ["engine", "body", "electrical", "suspension", "brakes", "interior", "other"];

// Column order MUST match src/app/api/admin/parts/template/route.ts.
const CSV_HEADERS = [
  "slug", "oem_number", "name_ru", "name_uz", "name_en",
  "description_ru", "description_uz", "description_en",
  "category", "brand", "price_usd", "original_price_usd", "wholesale_price_usd",
  "min_order_qty", "stock_qty", "images", "is_published",
  "fits_brands", "fits_models", "fits_year_from", "fits_year_to", "order_position",
];

const DEFAULT_SEARCHES = [
  { q: "тормозные колодки", category: "brakes" },
  { q: "воздушный фильтр", category: "engine" },
  { q: "масляный фильтр", category: "engine" },
  { q: "амортизатор", category: "suspension" },
  { q: "фара", category: "electrical" },
  { q: "коврики салона", category: "interior" },
];

function slugify(input) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/** Transliterate Cyrillic so slugs stay URL-safe (titles are mostly Russian). */
const TRANSLIT = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
function translit(s) {
  return s.toLowerCase().split("").map((ch) => (TRANSLIT[ch] ?? ch)).join("");
}

/** OLX photo template → a concrete URL at a sane size. */
function photoUrl(offer) {
  const p = (offer?.photos || [])[0];
  if (!p?.link) return "";
  const url = p.link.replace("{width}x{height}", "1000x1000");
  return /^https?:\/\//.test(url) ? url : "";
}

function offerPrice(offer) {
  const params = Array.isArray(offer?.params) ? offer.params : [];
  const pp = params.find((p) => p?.key === "price" || p?.type === "price");
  const pv = pp?.value;
  if (!pv || typeof pv !== "object") return { uzs: null, label: "" };
  const cur = String(pv.currency || "").toUpperCase();
  let uzs = null;
  if (typeof pv.value === "number") uzs = cur === "USD" ? pv.value * USD_UZS : pv.value; // assume UZS otherwise
  return { uzs, label: pv.label || "" };
}

function offerState(offer) {
  const params = Array.isArray(offer?.params) ? offer.params : [];
  const st = params.find((p) => p?.key === "state");
  return st?.value?.label || "";
}

async function main() {
  const searches = loadJsonOrDefault("OLX_PARTS_SEARCHES_FILE", DEFAULT_SEARCHES).filter(
    (s) => s && s.q && PART_CATEGORIES.includes((s.category || "other").toLowerCase()),
  );
  if (!searches.length) {
    log.error("no valid searches (each needs { q, category∈PART_CATEGORIES })");
    process.exit(1);
  }

  const rows = [];
  const seenSlugs = new Set();

  const crawler = new HttpCrawler({
    ...baseCrawlerOptions({ maxConcurrency: 2 }),
    additionalMimeTypes: ["application/json"],
    preNavigationHooks: [
      async ({ request }) => {
        request.headers = { ...request.headers, "user-agent": UA, accept: "application/json", "accept-language": "ru,en;q=0.8" };
      },
    ],
    async requestHandler({ request, body, json, session }) {
      const cfg = request.userData.search;
      const data = json || JSON.parse(body.toString());
      const offers = Array.isArray(data?.data) ? data.data : [];
      if (offers.length === 0 && session) session.markBad();

      let n = 0;
      for (const o of offers.slice(0, PER_SEARCH)) {
        const title = (o?.title || "").trim().slice(0, 200);
        if (!title) continue;
        const { uzs, label } = offerPrice(o);
        const priceUsd = uzs != null && uzs > 0 ? Math.round((uzs / USD_UZS) * 100) / 100 : "";

        let base = slugify(translit(title)) || `olx-part-${o.id || n}`;
        let slug = base;
        let k = 2;
        while (seenSlugs.has(slug)) slug = `${base}-${k++}`;
        seenSlugs.add(slug);

        const state = offerState(o);
        const city = o?.location?.city?.name || "";
        const noteParts = [label && `OLX: ${label}`, state, city, o?.url].filter(Boolean);

        rows.push({
          slug,
          oem_number: "",
          name_ru: title,
          name_uz: "",
          name_en: "",
          description_ru: noteParts.join(" · "),
          description_uz: "",
          description_en: "",
          category: (cfg.category || "other").toLowerCase(),
          brand: cfg.brand || "",
          price_usd: priceUsd,
          original_price_usd: "",
          wholesale_price_usd: "",
          min_order_qty: 1,
          stock_qty: 0,
          images: photoUrl(o),
          is_published: "false", // DRAFT — review before publishing
          fits_brands: Array.isArray(cfg.fits_brands) ? cfg.fits_brands.join(";") : (cfg.fits_brands || ""),
          fits_models: Array.isArray(cfg.fits_models) ? cfg.fits_models.join(";") : (cfg.fits_models || ""),
          fits_year_from: cfg.fits_year_from ?? "",
          fits_year_to: cfg.fits_year_to ?? "",
          order_position: 0,
        });
        n++;
      }
      log.info(`${cfg.q}: ${n} parts`);
    },
    failedRequestHandler({ request }) {
      log.warning(`failed after retries: ${request.userData.search?.q}`);
    },
  });

  await crawler.run(
    searches.map((s) => ({
      url: `${API}?offset=0&limit=${Math.min(PER_SEARCH, 40)}&query=${encodeURIComponent(s.q)}`,
      userData: { search: s },
    })),
  );

  if (rows.length === 0) {
    log.error("0 parts extracted (OLX API returned nothing).");
    process.exit(2);
  }
  const res = writeCsv(OUT, CSV_HEADERS, rows);
  log.info(`wrote ${res.rows} DRAFT parts → ${res.path}`);
  log.info("Next: Admin → Parts → Import → upload this CSV (dry-run first), review, then publish.");
}

main().catch((e) => {
  log.error(e?.stack || String(e));
  process.exit(1);
});
