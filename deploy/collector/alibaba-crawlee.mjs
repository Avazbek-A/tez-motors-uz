/**
 * Alibaba spare-parts crawler — Crawlee edition.
 *
 * Scrapes Alibaba search results for car parts and writes a REVIEWABLE CSV in the
 * exact shape the app's /api/admin/parts/import endpoint reads. Rows are emitted
 * as DRAFTS (is_published=false) on purpose: scraped data (titles, prices, photos,
 * rights) must be reviewed + translated by the dealer before it goes live. The
 * admin uploads the CSV via the existing Parts → Import UI (dry-run, then import).
 *
 * Why Crawlee here: Alibaba is JS-rendered and anti-bot. Crawlee gives us a
 * fingerprinted PlaywrightCrawler, a rotating session pool (banned sessions auto-
 * retired), proxy rotation, and retries — the robustness a hand-rolled scraper
 * lacks. HONEST CAVEAT: Alibaba blocks datacenter IPs aggressively. Without
 * PROXY_URLS (residential), expect captchas / empty results. Set PROXY_URLS and
 * run gently. This script is the extractor; the proxies are the anti-bot lever.
 *
 * Setup (on the box):
 *   cd deploy/collector && npm install && npx playwright install chromium
 *   export PROXY_URLS="http://user:pass@residential-gw:8000"   # strongly recommended
 *   # optional: a JSON file of searches (see DEFAULT_SEARCHES shape):
 *   export ALIBABA_SEARCHES_FILE=./alibaba-searches.json
 *   export ALIBABA_OUT=./alibaba-parts.csv        # output path (default)
 *   export ALIBABA_PER_SEARCH=20                   # cap rows per query
 *   node alibaba-crawlee.mjs
 * Then in the app: Admin → Parts → Import → upload alibaba-parts.csv (dry-run first).
 *
 * Respect Alibaba ToS/robots. This sources reference data the dealer has rights to
 * resell; verify product, price, and image rights before publishing.
 */
import { PlaywrightCrawler, Configuration } from "crawlee";
import { baseCrawlerOptions, writeCsv, loadJsonOrDefault, log } from "./crawlee-shared.mjs";

Configuration.getGlobalConfig().set("persistStorage", false);

const OUT = process.env.ALIBABA_OUT || "./alibaba-parts.csv";
const PER_SEARCH = Number(process.env.ALIBABA_PER_SEARCH || 20);

// Column order MUST match src/app/api/admin/parts/template/route.ts (the import
// endpoint reads these headers; list columns use ";" as the delimiter).
const CSV_HEADERS = [
  "slug", "oem_number", "name_ru", "name_uz", "name_en",
  "description_ru", "description_uz", "description_en",
  "category", "brand", "price_usd", "original_price_usd", "wholesale_price_usd",
  "min_order_qty", "stock_qty", "images", "is_published",
  "fits_brands", "fits_models", "fits_year_from", "fits_year_to", "order_position",
];

// Each search maps a query → a catalog category + (optional) fitment the crawler
// can't infer from a listing. Categories must be valid PART_CATEGORIES.
const DEFAULT_SEARCHES = [
  { q: "car air filter", category: "engine" },
  { q: "brake pads", category: "brakes" },
  { q: "car shock absorber", category: "suspension" },
  { q: "car led headlight", category: "electrical" },
  { q: "car door handle", category: "body" },
  { q: "car floor mats", category: "interior" },
];

const PART_CATEGORIES = ["engine", "body", "electrical", "suspension", "brakes", "interior", "other"];

function slugify(input) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110);
}

/** Lowest USD figure from an Alibaba price string ("US$1.20 - 3.50/piece" → 1.2). */
function priceLow(text) {
  if (!text) return null;
  const nums = String(text).replace(/,/g, "").match(/\d+(?:\.\d+)?/g);
  if (!nums) return null;
  const vals = nums.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  return vals.length ? Math.min(...vals) : null;
}

/** First integer from a MOQ string ("Min. order: 100 pieces" → 100). */
function moq(text) {
  const m = String(text || "").match(/\d[\d,]*/);
  return m ? Number(m[0].replace(/,/g, "")) : null;
}

const searchUrl = (q) =>
  `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(q)}`;

/**
 * Extract product cards from a rendered Alibaba search page. Alibaba's class names
 * churn, so we extract defensively: find anchors to product detail pages, then
 * read the nearest title / price / image / MOQ within the card container. Returns
 * a plain array so it survives most layout changes.
 */
function extractCards() {
  const seen = new Set();
  const out = [];
  const anchors = Array.from(
    document.querySelectorAll('a[href*="/product-detail/"], a[href*="product_id"]'),
  );
  for (const a of anchors) {
    const href = a.getAttribute("href") || "";
    if (!href) continue;
    const url = href.startsWith("http") ? href : `https:${href.replace(/^\/+/, "//")}`;
    // Walk up to the card container (cap the climb so we don't grab the whole page).
    let card = a;
    for (let i = 0; i < 5 && card.parentElement; i++) {
      card = card.parentElement;
      if (card.querySelector("img") && /\$|US\$|\d/.test(card.textContent || "")) break;
    }
    const title = (a.getAttribute("title") || a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 200);
    if (!title || title.length < 6) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const text = (card.textContent || "").replace(/\s+/g, " ");
    const priceMatch = text.match(/US?\$\s?[\d.,]+(?:\s?-\s?\$?\s?[\d.,]+)?/);
    const moqMatch = text.match(/Min\.?\s*order[^\d]*[\d,]+\s*\w*/i);
    const img = card.querySelector("img");
    let imgUrl = img ? (img.getAttribute("src") || img.getAttribute("data-src") || "") : "";
    if (imgUrl.startsWith("//")) imgUrl = "https:" + imgUrl;

    out.push({
      title,
      url: url.split("?")[0],
      price: priceMatch ? priceMatch[0] : "",
      moq: moqMatch ? moqMatch[0] : "",
      image: /^https?:\/\//.test(imgUrl) && /\.(jpe?g|png|webp)/i.test(imgUrl) ? imgUrl : "",
    });
  }
  return out;
}

async function main() {
  const searches = loadJsonOrDefault("ALIBABA_SEARCHES_FILE", DEFAULT_SEARCHES).filter(
    (s) => s && s.q && PART_CATEGORIES.includes((s.category || "other").toLowerCase()),
  );
  if (!searches.length) {
    log.error("no valid searches (each needs { q, category∈PART_CATEGORIES })");
    process.exit(1);
  }

  const rows = [];
  const seenSlugs = new Set();

  const crawler = new PlaywrightCrawler({
    ...baseCrawlerOptions({ maxConcurrency: 1 }), // gentle — Alibaba bans fast
    launchContext: { launchOptions: { headless: true } },
    async requestHandler({ page, request, session }) {
      // Search config rides on userData (robust to Alibaba mutating the URL).
      const cfg = request.userData?.search || { category: "other" };
      // Let the SPA render + lazy-load.
      await page.waitForTimeout(3500);
      await page.evaluate(async () => {
        for (let y = 0; y < 4000; y += 800) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 300)); }
      });
      await page.waitForTimeout(1000);

      // Detect a block/captcha wall → retire this session so Crawlee rotates.
      const title = (await page.title()).toLowerCase();
      const blocked = /captcha|verify|robot|punish|sliding/.test(title);
      const cards = blocked ? [] : await page.evaluate(extractCards);
      if ((blocked || cards.length === 0) && session) {
        session.markBad();
        throw new Error(blocked ? "captcha/block wall" : "no cards (likely soft-block)");
      }

      let n = 0;
      for (const c of cards.slice(0, PER_SEARCH)) {
        const price = priceLow(c.price);
        let slug = slugify(c.title);
        if (!slug) continue;
        let uniq = slug;
        let k = 2;
        while (seenSlugs.has(uniq)) uniq = `${slug}-${k++}`;
        seenSlugs.add(uniq);

        rows.push({
          slug: uniq,
          oem_number: "",
          name_ru: c.title, // English title — admin translates RU/UZ on review
          name_uz: "",
          name_en: c.title,
          description_ru: "",
          description_uz: "",
          description_en: c.url ? `Source: ${c.url}` : "",
          category: (cfg.category || "other").toLowerCase(),
          brand: cfg.brand || "",
          price_usd: price ?? "",
          original_price_usd: "",
          wholesale_price_usd: "",
          min_order_qty: moq(c.moq) ?? "",
          stock_qty: 0,
          images: c.image || "",
          is_published: "false", // DRAFT — review before publishing
          fits_brands: Array.isArray(cfg.fits_brands) ? cfg.fits_brands.join(";") : (cfg.fits_brands || ""),
          fits_models: Array.isArray(cfg.fits_models) ? cfg.fits_models.join(";") : (cfg.fits_models || ""),
          fits_year_from: cfg.fits_year_from ?? "",
          fits_year_to: cfg.fits_year_to ?? "",
          order_position: 0,
        });
        n++;
      }
      log.info(`${cfg.q || request.url}: ${n} parts`);
    },
    failedRequestHandler({ request }) {
      log.warning(`failed after retries: ${request.url} — Alibaba likely blocked (set PROXY_URLS).`);
    },
  });

  await crawler.run(searches.map((s) => ({ url: searchUrl(s.q), userData: { search: s } })));

  if (rows.length === 0) {
    log.error("0 parts extracted — Alibaba almost certainly blocked the crawl. Set PROXY_URLS (residential) and retry.");
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
