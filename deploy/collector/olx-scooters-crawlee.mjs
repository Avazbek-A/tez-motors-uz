/**
 * OLX (olx.uz) scooters / e-bikes crawler — feeds the `scooters` product vertical.
 *
 * Light EVs are scattered across several OLX categories (no single "scooters"
 * category like cars=983 or parts=310), so we drive this by QUERY (RU + popular
 * brand names) and rely on the importer's junk filter + the free-LLM cleanup to
 * keep only genuine e-scooters / e-bikes. Captures title, price (UZS→USD) and up to
 * 6 photos per listing. Emits olx-scooters.json for import-scooters.mjs.
 *
 * Proxy-free OLX public JSON API; run gently. Respect OLX ToS.
 *   cd deploy/collector && node olx-scooters-crawlee.mjs
 */
import { writeFileSync } from "node:fs";
import { HttpCrawler, Configuration } from "crawlee";
import { UA, baseCrawlerOptions, loadJsonOrDefault, log } from "./crawlee-shared.mjs";

Configuration.getGlobalConfig().set("persistStorage", false);

const API = "https://www.olx.uz/api/v1/offers/";
const OUT = process.env.OLX_SCOOTERS_OUT || "./olx-scooters.json";
const PER_SEARCH = Number(process.env.OLX_SCOOTERS_PER_SEARCH || 30);
const USD_UZS = Number(process.env.USD_UZS || 12600);
const MAX_PHOTOS = Number(process.env.OLX_SCOOTERS_MAX_PHOTOS || 6);

// query → the kind we expect (LLM verifies/overrides later).
const DEFAULT_SEARCHES = [
  { q: "электросамокат", kind: "escooter" },
  { q: "электро самокат", kind: "escooter" },
  { q: "самокат электрический", kind: "escooter" },
  { q: "электровелосипед", kind: "ebike" },
  { q: "электро велосипед", kind: "ebike" },
  { q: "Kugoo", kind: "escooter" },
  { q: "Ninebot", kind: "escooter" },
  { q: "Segway", kind: "escooter" },
  { q: "Xiaomi самокат", kind: "escooter" },
  { q: "Teverun", kind: "escooter" },
  { q: "Dualtron", kind: "escooter" },
  { q: "Kaabo", kind: "escooter" },
];

function slugify(input) {
  return input.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}
const TRANSLIT = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
const translit = (s) => s.toLowerCase().split("").map((ch) => TRANSLIT[ch] ?? ch).join("");

function offerPrice(offer) {
  const pp = (offer?.params || []).find((p) => p?.key === "price" || p?.type === "price");
  const pv = pp?.value;
  if (!pv || typeof pv !== "object" || typeof pv.value !== "number") return null;
  const cur = String(pv.currency || "").toUpperCase();
  return cur === "USD" ? pv.value : pv.value / USD_UZS;
}
function photoUrls(offer) {
  return (offer?.photos || []).slice(0, MAX_PHOTOS)
    .map((p) => (p?.link || "").replace("{width}x{height}", "1000x1000"))
    .filter((u) => /^https?:\/\//.test(u));
}

async function main() {
  const searches = loadJsonOrDefault("OLX_SCOOTERS_SEARCHES_FILE", DEFAULT_SEARCHES).filter((s) => s && s.q);
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
        const priceRaw = offerPrice(o);
        const price = priceRaw != null && priceRaw > 0 ? Math.round(priceRaw * 100) / 100 : null;
        const photos = photoUrls(o);
        if (!title || photos.length === 0) continue;

        let base = slugify(translit(title)) || `olx-scooter-${o.id || n}`;
        let slug = base; let k = 2;
        while (seenSlugs.has(slug)) slug = `${base}-${k++}`;
        seenSlugs.add(slug);

        rows.push({
          slug,
          kind: s.kind || "escooter",
          title,
          price_usd: price,
          city: o?.location?.city?.name || "",
          url: o?.url || "",
          images: photos,
        });
        n++;
      }
      log.info(`${s.q}: ${n} scooters`);
    },
    failedRequestHandler({ request }) { log.warning(`failed after retries: ${request.userData.search?.q}`); },
  });

  await crawler.run(searches.map((s) => ({
    url: `${API}?offset=0&limit=${Math.min(PER_SEARCH, 40)}&query=${encodeURIComponent(s.q)}`,
    userData: { search: s },
  })));

  if (rows.length === 0) { log.error("0 scooters extracted."); process.exit(2); }
  writeFileSync(OUT, JSON.stringify(rows));
  log.info(`wrote ${rows.length} scooter rows → ${OUT}`);
  log.info("Next: node import-scooters.mjs --write (rehost photos + insert DRAFTS), then node scooters-llm-clean.mjs --write --publish.");
}
main().catch((e) => { log.error(e?.stack || String(e)); process.exit(1); });
