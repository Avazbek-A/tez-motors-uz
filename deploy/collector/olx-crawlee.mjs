/**
 * OLX (olx.uz) market-price crawler — Crawlee edition.
 *
 * Replaces the old naive fetch-loop + ad-hoc Playwright fallback (olx-collector.mjs)
 * with Crawlee's managed crawling: automatic retries + backoff, a rotating session
 * pool (banned cookie-sets retired automatically), optional proxy rotation
 * (PROXY_URLS), bounded concurrency, and realistic browser fingerprints on the
 * browser fallback. Same ingest contract as before, so it's a drop-in upgrade.
 *
 * Strategy (API-first, browser-fallback — both Crawlee-managed):
 *   1) HttpCrawler over OLX's public JSON API. Structured, fast, no browser.
 *   2) PlaywrightCrawler over the human search pages for any query the API
 *      returned nothing for (blocked / shape change). Fingerprinted + session-
 *      pooled so it survives light anti-bot.
 *
 * Respect OLX ToS + robots.txt; run gently (a few searches a few times a day).
 *
 * Setup (on the box):
 *   cd deploy/collector && npm install && npx playwright install chromium
 *   export INGEST_URL="https://tezmotors.uz/api/admin/market/ingest"
 *   export MARKET_INGEST_SECRET="…same value as the app secret…"
 *   # optional: export PROXY_URLS="http://user:pass@gw:8000,…"
 *   # optional: export OLX_SEARCHES_FILE=./searches.json
 *   node olx-crawlee.mjs
 * Schedule with cron/systemd-timer (e.g. every 6h).
 */
import { HttpCrawler, PlaywrightCrawler, Configuration } from "crawlee";
import { UA, baseCrawlerOptions, ingestListings, loadJsonOrDefault, log } from "./crawlee-shared.mjs";

// Keep Crawlee's state ephemeral so repeated cron runs don't accumulate disk.
Configuration.getGlobalConfig().set("persistStorage", false);

const API = "https://www.olx.uz/api/v1/offers/";
const PER_SEARCH = Number(process.env.OLX_PER_SEARCH || 40);

const DEFAULT_SEARCHES = [
  { q: "byd song plus", brand: "BYD", model: "Song Plus" },
  { q: "byd seal", brand: "BYD", model: "Seal" },
  { q: "chery tiggo 8", brand: "Chery", model: "Tiggo 8" },
  { q: "chery tiggo 7", brand: "Chery", model: "Tiggo 7" },
  { q: "haval jolion", brand: "Haval", model: "Jolion" },
  { q: "haval h6", brand: "Haval", model: "H6" },
  { q: "geely coolray", brand: "Geely", model: "Coolray" },
  { q: "geely monjaro", brand: "Geely", model: "Monjaro" },
  { q: "changan cs75", brand: "Changan", model: "CS75 Plus" },
  { q: "zeekr 001", brand: "Zeekr", model: "001" },
];

/** Map one OLX API offer → an ingest listing. Defensive about field paths. */
function mapOffer(offer, search) {
  const params = Array.isArray(offer?.params) ? offer.params : [];
  const find = (pred) => params.find(pred);
  const priceParam = find((p) => p?.key === "price" || p?.type === "price");
  const yearParam = find((p) => /year/i.test(p?.key || "") || /год|yil|year/i.test(p?.name || ""));

  let priceRaw = null;
  let currency = null;
  const pv = priceParam?.value;
  if (pv && typeof pv === "object") {
    if (typeof pv.value === "number") priceRaw = pv.value;
    if (typeof pv.currency === "string") currency = pv.currency;
  }
  const yearVal = Number(
    (yearParam?.value && (yearParam.value.key || yearParam.value.value || yearParam.value.label)) ||
      (offer?.title?.match(/\b(20\d{2})\b/) || [])[1] ||
      "",
  );
  const city = offer?.location?.city?.name || offer?.location?.region?.name || null;
  const priceLabel = (pv && pv.label) || "";
  return {
    source: "olx",
    source_ref: offer?.url || (offer?.id != null ? `olx:${offer.id}` : null),
    brand: search.brand,
    model: search.model,
    year: Number.isFinite(yearVal) && yearVal >= 1990 ? yearVal : null,
    price_raw: priceRaw,
    currency,
    city,
    raw_text: `${priceLabel} ${offer?.title || ""}`.trim() || null,
    posted_at: offer?.created_time || offer?.last_refresh_time || null,
  };
}

const apiUrl = (q) => `${API}?offset=0&limit=${PER_SEARCH}&query=${encodeURIComponent(q)}`;
const pageUrl = (q) =>
  `https://www.olx.uz/transport/legkovye-avtomobili/q-${encodeURIComponent(q).replace(/%20/g, "-")}/`;

async function main() {
  const searches = loadJsonOrDefault("OLX_SEARCHES_FILE", DEFAULT_SEARCHES);
  const byQ = new Map(searches.map((s) => [s.q, s]));
  const listings = [];
  const gotResults = new Set();

  // --- Pass 1: HttpCrawler over the JSON API (managed retries/sessions/proxy) ---
  const apiCrawler = new HttpCrawler({
    ...baseCrawlerOptions({ maxConcurrency: 2 }),
    additionalMimeTypes: ["application/json"],
    preNavigationHooks: [
      async ({ request }) => {
        request.headers = {
          ...request.headers,
          "user-agent": UA,
          accept: "application/json",
          "accept-language": "ru,en;q=0.8",
        };
      },
    ],
    async requestHandler({ request, body, json, session }) {
      const search = byQ.get(request.userData.q);
      if (!search) return;
      const data = json || JSON.parse(body.toString());
      const offers = Array.isArray(data?.data) ? data.data : [];
      // Empty/odd payload on a 200 often means a soft-block → mark session bad.
      if (offers.length === 0 && session) session.markBad();
      let n = 0;
      for (const o of offers) {
        const mapped = mapOffer(o, search);
        if (mapped.price_raw != null || mapped.raw_text) {
          listings.push(mapped);
          n++;
        }
      }
      if (n > 0) gotResults.add(search.q);
      log.info(`API ${search.brand} ${search.model}: ${n}`);
    },
    failedRequestHandler({ request }) {
      log.warning(`API failed after retries: ${request.userData.q} (${request.errorMessages?.slice(-1)})`);
    },
  });

  await apiCrawler.run(searches.map((s) => ({ url: apiUrl(s.q), userData: { q: s.q } })));

  // --- Pass 2: PlaywrightCrawler fallback for queries the API didn't cover ---
  const missing = searches.filter((s) => !gotResults.has(s.q));
  if (missing.length) {
    log.info(`browser fallback for ${missing.length} query(ies) the API missed`);
    const browserCrawler = new PlaywrightCrawler({
      ...baseCrawlerOptions({ maxConcurrency: 2 }),
      // Crawlee injects realistic, rotating fingerprints by default — survives
      // light anti-bot without us hand-rolling stealth.
      launchContext: { launchOptions: { headless: true } },
      async requestHandler({ page, request, session }) {
        const search = byQ.get(request.userData.q);
        if (!search) return;
        await page.waitForTimeout(2000);
        const cards = await page.$$eval('[data-cy="l-card"]', (els) =>
          els.slice(0, 40).map((c) => {
            const a = c.querySelector("a");
            const price = c.querySelector('[data-testid="ad-price"]');
            return {
              text: (c.textContent || "").trim().slice(0, 300),
              href: a?.getAttribute("href") || null,
              price: price?.textContent || null,
            };
          }),
        );
        if (cards.length === 0 && session) session.markBad();
        let n = 0;
        for (const c of cards) {
          if (!c.price) continue;
          listings.push({
            source: "olx",
            source_ref: c.href ? (c.href.startsWith("http") ? c.href : `https://www.olx.uz${c.href}`) : null,
            brand: search.brand,
            model: search.model,
            year: Number((c.text.match(/\b(20\d{2})\b/) || [])[1]) || null,
            raw_text: `${c.price} ${c.text}`,
          });
          n++;
        }
        log.info(`browser ${search.brand} ${search.model}: ${n}`);
      },
      failedRequestHandler({ request }) {
        log.warning(`browser failed after retries: ${request.userData.q}`);
      },
    });
    await browserCrawler.run(missing.map((s) => ({ url: pageUrl(s.q), userData: { q: s.q } })));
  }

  log.info(`collected ${listings.length} listings across ${searches.length} searches`);
  const result = await ingestListings("olx", listings);
  log.info(`done — received ${result.received}, stored ${result.stored}`);
}

main().catch((e) => {
  log.error(e?.stack || String(e));
  process.exit(1);
});
