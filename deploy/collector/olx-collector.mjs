/**
 * OLX (olx.uz) market-price collector. Runs OFF Cloudflare Workers — on your
 * Vostro / any Node box — and POSTs competitor listings to the website's
 * /api/admin/market/ingest endpoint, which normalizes prices (UZS↔USD) and
 * dedupes by fingerprint.
 *
 * Two strategies, API-first:
 *   1) OLX public JSON API (https://www.olx.uz/api/v1/offers/?query=…). Plain
 *      fetch, structured data, no browser — far more robust than DOM scraping.
 *   2) Playwright DOM fallback (only if the API is blocked/changes shape).
 *
 * Respect OLX's ToS + robots.txt; run gently (a few searches a few times a day).
 *
 * Setup (on the box):
 *   cd deploy/collector && npm install   # playwright only needed for the fallback
 *   export INGEST_URL="https://tezmotors.uz/api/admin/market/ingest"
 *   export MARKET_INGEST_SECRET="…same value as the app secret…"
 *   # optional: point at a JSON file of {q,brand,model} searches:
 *   export OLX_SEARCHES_FILE=./searches.json
 *   node olx-collector.mjs
 * Schedule with cron/systemd-timer (e.g. every 6h).
 */
import { readFileSync } from "node:fs";

const INGEST_URL = process.env.INGEST_URL;
const SECRET = process.env.MARKET_INGEST_SECRET;
const API = "https://www.olx.uz/api/v1/offers/";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const PER_SEARCH = 40;

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

function loadSearches() {
  const f = process.env.OLX_SEARCHES_FILE;
  if (!f) return DEFAULT_SEARCHES;
  try {
    return JSON.parse(readFileSync(f, "utf8"));
  } catch (e) {
    console.error(`couldn't read ${f}, using defaults:`, e.message);
    return DEFAULT_SEARCHES;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Map one OLX API offer → an ingest listing. Defensive about field paths. */
function mapOffer(offer, search) {
  const params = Array.isArray(offer?.params) ? offer.params : [];
  const find = (pred) => params.find(pred);
  const priceParam = find((p) => p?.key === "price" || p?.type === "price");
  const yearParam = find((p) => /year/i.test(p?.key || "") || /год|yil|year/i.test(p?.name || ""));

  // Price can be {value:{value, currency, label}} across OLX variants.
  let priceRaw = null;
  let currency = null;
  const pv = priceParam?.value;
  if (pv && typeof pv === "object") {
    if (typeof pv.value === "number") priceRaw = pv.value;
    if (typeof pv.currency === "string") currency = pv.currency;
    if (priceRaw == null && typeof pv.label === "string") priceRaw = null; // leave to raw_text
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
    // The server parses messy price strings; pass the label + title as a backstop.
    raw_text: `${priceLabel} ${offer?.title || ""}`.trim() || null,
    posted_at: offer?.created_time || offer?.last_refresh_time || null,
  };
}

async function viaApi(search) {
  const url = `${API}?offset=0&limit=${PER_SEARCH}&query=${encodeURIComponent(search.q)}`;
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json", "accept-language": "ru,en;q=0.8" },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = await res.json();
  const offers = Array.isArray(json?.data) ? json.data : [];
  return offers.map((o) => mapOffer(o, search)).filter((l) => l.price_raw != null || l.raw_text);
}

async function viaBrowser(searches) {
  // Lazy import so the API path doesn't require playwright to be installed.
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: UA });
  const out = [];
  for (const s of searches) {
    try {
      const url = `https://www.olx.uz/transport/legkovye-avtomobili/q-${encodeURIComponent(s.q).replace(/%20/g, "-")}/`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(2500);
      const items = await page.$$eval('[data-cy="l-card"]', (cards) =>
        cards.slice(0, 40).map((c) => {
          const a = c.querySelector("a");
          const price = c.querySelector('[data-testid="ad-price"]');
          return { text: (c.textContent || "").trim().slice(0, 300), href: a?.getAttribute("href") || null, price: price?.textContent || null };
        }),
      );
      for (const i of items) {
        if (!i.price) continue;
        out.push({
          source: "olx",
          source_ref: i.href ? (i.href.startsWith("http") ? i.href : `https://www.olx.uz${i.href}`) : null,
          brand: s.brand,
          model: s.model,
          year: Number((i.text.match(/\b(20\d{2})\b/) || [])[1]) || null,
          raw_text: `${i.price} ${i.text}`,
        });
      }
    } catch (e) {
      console.error(`browser ${s.brand} ${s.model}:`, e.message);
    }
    await sleep(1500 + Math.floor(Math.random() * 1500));
  }
  await browser.close();
  return out;
}

async function ingest(listings) {
  if (listings.length === 0) return console.log("nothing to ingest");
  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
    body: JSON.stringify({ source: "olx", listings: listings.slice(0, 500) }),
  });
  console.log("ingest:", res.status, (await res.text()).slice(0, 300));
}

async function main() {
  if (!INGEST_URL || !SECRET) {
    console.error("Set INGEST_URL and MARKET_INGEST_SECRET");
    process.exit(1);
  }
  const searches = loadSearches();
  const listings = [];
  let apiWorked = false;
  for (const s of searches) {
    try {
      const found = await viaApi(s);
      listings.push(...found);
      if (found.length) apiWorked = true;
      console.log(`API ${s.brand} ${s.model}: ${found.length}`);
    } catch (e) {
      console.error(`API ${s.brand} ${s.model}: ${e.message}`);
    }
    await sleep(1200 + Math.floor(Math.random() * 1200));
  }

  // If the API yielded nothing at all, fall back to the browser path.
  if (!apiWorked) {
    console.log("API yielded nothing — falling back to Playwright DOM scrape");
    try {
      listings.push(...(await viaBrowser(searches)));
    } catch (e) {
      console.error("browser fallback failed (is playwright installed?):", e.message);
    }
  }

  await ingest(listings);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
