/**
 * Gonzo Motors (gonzo-motors.uz) discovery scraper — Crawlee edition.
 *
 * Purpose: build a DISCOVERY LIST — what a Tashkent competitor stocks — to use as a
 * shopping guide. We capture only the public listing facts (name, price, product URL,
 * thumbnail) for market intelligence; we DO NOT republish their photos/text. The real
 * assets (full specs, manufacturer photos/video) are sourced separately and legitimately
 * from AutoHome (config JSON) and Alibaba (autohome-crawlee.mjs / alibaba-crawlee.mjs),
 * then enriched onto tezmotors.uz — richer than the source list.
 *
 * gonzo-motors.uz is a Tilda site; its catalog/parts grids are Tilda Store widgets that
 * render product cards client-side, so we render once (Playwright) and scrape the cards,
 * scrolling to load the full grid. No anti-bot (marketing site) — gentle + direct.
 *
 * Output: reviewable JSON + CSV (the guide). NEVER auto-published.
 *
 * Usage (on the box / Mac):
 *   npm run gonzo                                   # catalog (cars) + zapchast (parts)
 *   node gonzo-crawlee.mjs https://gonzo-motors.uz/catalog   # one list
 */
import { PlaywrightCrawler, Configuration } from "crawlee";
import { baseCrawlerOptions, writeCsv, log } from "./crawlee-shared.mjs";
import { writeFileSync } from "node:fs";

Configuration.getGlobalConfig().set("persistStorage", false);

const ARGS = process.argv.slice(2).filter((a) => /^https?:/.test(a));
const TARGETS = ARGS.length ? ARGS.map((url) => ({ url, kind: /zapchast|part/i.test(url) ? "part" : "car" }))
  : [
      { url: "https://gonzo-motors.uz/catalog", kind: "car" },
      { url: "https://gonzo-motors.uz/zapchast", kind: "part" },
    ];

const rows = [];

const crawler = new PlaywrightCrawler({
  ...baseCrawlerOptions({ maxConcurrency: 1 }),
  navigationTimeoutSecs: 45,
  launchContext: { launchOptions: { headless: true } },
  preNavigationHooks: [async (_c, gotoOptions) => { gotoOptions.waitUntil = "domcontentloaded"; }],
  async requestHandler({ page, request }) {
    const kind = request.userData?.kind || "car";
    await page.waitForSelector(".t-store__card, .js-product", { timeout: 25000 }).catch(() => {});
    // Tilda Store lazy-loads on scroll / "show more" — load the whole grid.
    let prev = 0;
    for (let i = 0; i < 25; i++) {
      const n = await page.evaluate(() => {
        document.querySelectorAll(".t-store__load-more-btn, .js-store-load-more-btn, [class*='load-more']").forEach((b) => b.click());
        window.scrollTo(0, document.body.scrollHeight);
        return document.querySelectorAll(".t-store__card, .js-product").length;
      });
      await page.waitForTimeout(900);
      if (n === prev) break;
      prev = n;
    }
    const items = await page.evaluate(() => {
      const clean = (s) => (s || "").replace(/^["']|["']$/g, "").trim();
      const bg = (el) => { const m = (el?.getAttribute("style") || "").match(/url\((["']?)([^)"']+)\1\)/); return m ? m[2] : null; };
      // Two Tilda Store templates seen on gonzo: catalog uses .js-store-prod-*,
      // zapchast uses .js-product-*. Cover both.
      return Array.from(document.querySelectorAll(".t-store__card, .js-product")).map((el) => {
        const imgEl = el.querySelector(".js-product-img, .t-store__card__img, img, [class*='bgimg'], [style*='background']");
        const linkEl = el.querySelector(".js-product-link, a");
        return {
          name: (el.querySelector(".js-store-prod-name, .js-product-name, .t-store__card__title")?.textContent || "").replace(/\s+/g, " ").trim(),
          price: (el.querySelector(".js-store-prod-price-value, .js-product-price, .t-store__card__price-value")?.textContent || "").replace(/\s+/g, " ").trim(),
          currency: (el.querySelector(".js-store-prod-price-currency, .t-store__card__price-currency")?.textContent || "").trim(),
          uid: el.getAttribute("data-product-uid") || "",
          url: linkEl?.href || el.querySelector("a")?.href || el.getAttribute("data-product-url") || "",
          image: clean(imgEl?.getAttribute("data-original") || imgEl?.getAttribute("src") || bg(imgEl) || ""),
        };
      }).filter((x) => x.name);
    });
    // Dedupe by name+uid within this list.
    const seen = new Set();
    for (const it of items) {
      const key = (it.uid || it.name).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ kind, source_url: request.url, ...it });
    }
    log.info(`✓ ${request.url} (${kind}): ${items.length} items`);
  },
  failedRequestHandler({ request }) { log.warning(`failed: ${request.url}`); },
});

await crawler.run(TARGETS.map((t) => ({ url: t.url, userData: { kind: t.kind } })));

if (!rows.length) { log.error("0 items scraped — Tilda layout may have changed."); process.exit(2); }

const cars = rows.filter((r) => r.kind === "car");
const parts = rows.filter((r) => r.kind === "part");
writeFileSync("./gonzo-discovery.json", JSON.stringify({ capturedAt: new Date().toISOString(), cars, parts }, null, 2));
writeCsv("./gonzo-discovery.csv", ["kind", "name", "price", "currency", "url", "image", "uid", "source_url"], rows);
log.info(`\n── discovery list ──`);
log.info(`cars: ${cars.length} | parts: ${parts.length} | total: ${rows.length}`);
log.info(`wrote ./gonzo-discovery.json + ./gonzo-discovery.csv`);
log.info(`Next: feed names → autohome-crawlee.mjs (cars) + alibaba-crawlee.mjs (parts) to source rich specs/photos.`);
