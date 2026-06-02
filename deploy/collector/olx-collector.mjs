/**
 * OLX market-price collector (reference). Runs OFF Cloudflare Workers — on your
 * Vostro / any Node box — because OLX is behind anti-bot protection that a
 * Worker `fetch` can't pass. Uses a real browser (Playwright) to load OLX car
 * search pages, extracts listing cards, and POSTs them to the website's ingest
 * endpoint, which normalizes + dedupes them.
 *
 * THIS IS A STARTING POINT, not turn-key. OLX markup + anti-bot change; adjust
 * the selectors and respect OLX's Terms of Service and robots.txt. Run it at a
 * gentle cadence (e.g. a few searches a few times a day), not aggressively.
 *
 * Setup (on the box):
 *   npm i playwright
 *   npx playwright install chromium
 *   export INGEST_URL="https://tezmotors.uz/api/admin/market/ingest"
 *   export MARKET_INGEST_SECRET="...same value as the Worker secret..."
 *   node deploy/collector/olx-collector.mjs
 *
 * Schedule with cron/systemd-timer, e.g. every 6h.
 */
import { chromium } from "playwright";

const INGEST_URL = process.env.INGEST_URL;
const SECRET = process.env.MARKET_INGEST_SECRET;

// One entry per model you care about. `q` is the OLX search query; brand/model
// label what gets stored so aggregation groups them cleanly.
const SEARCHES = [
  { url: "https://www.olx.uz/transport/legkovye-avtomobili/q-byd-song-plus/", brand: "BYD", model: "Song Plus" },
  { url: "https://www.olx.uz/transport/legkovye-avtomobili/q-chery-tiggo-8/", brand: "Chery", model: "Tiggo 8" },
  // … add your models
];

async function scrapeSearch(page, search) {
  await page.goto(search.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500); // let the SPA hydrate

  // OLX listing cards. Selectors WILL drift — inspect and update as needed.
  const items = await page.$$eval('[data-cy="l-card"]', (cards) =>
    cards.slice(0, 40).map((c) => {
      const text = c.textContent || "";
      const a = c.querySelector("a");
      const href = a ? a.getAttribute("href") : null;
      const priceEl = c.querySelector('[data-testid="ad-price"]');
      return { text: text.trim().slice(0, 300), href, price: priceEl ? priceEl.textContent : null };
    }),
  );

  return items
    .filter((i) => i.price)
    .map((i) => ({
      source: "olx",
      source_ref: i.href || null,
      brand: search.brand,
      model: search.model,
      // Let the server parse the messy price string ("180 000 000 сум", "$15 000").
      raw_text: `${i.price} ${i.text}`,
      year: (i.text.match(/\b(20\d{2})\b/) || [])[1] ? Number((i.text.match(/\b(20\d{2})\b/) || [])[1]) : null,
    }));
}

async function main() {
  if (!INGEST_URL || !SECRET) {
    console.error("Set INGEST_URL and MARKET_INGEST_SECRET");
    process.exit(1);
  }
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36" });

  const listings = [];
  for (const search of SEARCHES) {
    try {
      const found = await scrapeSearch(page, search);
      listings.push(...found);
      console.log(`${search.brand} ${search.model}: ${found.length}`);
    } catch (e) {
      console.error(`failed ${search.brand} ${search.model}:`, e.message);
    }
    await page.waitForTimeout(1500 + Math.floor(Math.random() * 1500)); // be gentle
  }
  await browser.close();

  if (listings.length === 0) {
    console.log("nothing to ingest");
    return;
  }

  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SECRET}` },
    body: JSON.stringify({ source: "olx", listings }),
  });
  console.log("ingest:", res.status, await res.text());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
