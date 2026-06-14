/**
 * avtoelon.uz market-price crawler — the dedicated UZ car marketplace.
 *
 * avtoelon is a Nuxt SPA; its `?text=` search is client-rendered, but the brand
 * FILTER pages — https://avtoelon.uz/avto/<mark>/?page=N — are server-rendered and
 * each listing card carries a fully-structured <img alt> caption, e.g.:
 *   "Haval Jolion 2024 года, в Янгиюль за 24 000 y.e. id7322239"
 * So we fetch one filter page per brand the dealer stocks, parse the alt captions,
 * and — crucially — match each caption against the dealer's catalog models so the
 * stored brand|model is the canonical key the buying brain joins on (not avtoelon's
 * trim-suffixed title). Cards whose brand/model don't match the catalog are skipped
 * (incl. the sidebar "hot ads" bleed). Same ingest contract as olx-crawlee.
 *
 * Setup (on the box):
 *   export INGEST_URL="http://127.0.0.1:3000/api/admin/market/ingest"
 *   export MARKET_INGEST_SECRET="…same as the app secret…"
 *   export AVE_PAGES=2            # filter pages per brand (default 2)
 *   node avtoelon-crawlee.mjs
 * Schedule with the others (run-market.sh). Respect avtoelon ToS — run gently.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { HttpCrawler, Configuration } from "crawlee";
import { UA, baseCrawlerOptions, ingestListings, log } from "./crawlee-shared.mjs";

Configuration.getGlobalConfig().set("persistStorage", false);

const PAGES = Number(process.env.AVE_PAGES || 2);
const markSlug = (brand) => brand.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

function loadEnv() {
  for (const p of ["../../.env.local", "../.env.local", "./.env.local", "/home/rayxona/tez-motors/.env.local"]) {
    try { const e = {}; for (const l of readFileSync(resolve(p), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) e[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); } if (e.NEXT_PUBLIC_SUPABASE_URL) return e; } catch {}
  }
  return {};
}

/** Pull every structured listing caption (the <img alt> ending in id<digits>). */
function altsFrom(html) {
  return (html.match(/alt="([^"]*?id\d+)"/g) || []).map((m) => m.slice(5, -1));
}

/** Parse one caption → { id, year, priceRaw, currency }. Price is the number AFTER
 *  "за" (never the id/year), so the big id can't be mistaken for the price. */
function parseAlt(alt) {
  const idm = alt.match(/id(\d+)\s*$/);
  const pm = alt.match(/за\s*~?\s*([\d\s ]+?)\s*(y\.?\s?e\.?|у\.?\s?е\.?|сум|so['’ ]?m)/i);
  const ym = alt.match(/\b(20\d{2})\s*год/) || alt.match(/\b(20\d{2})\b/);
  if (!idm || !pm) return null;
  const priceRaw = parseInt(pm[1].replace(/\D/g, ""), 10);
  const currency = /сум|so/i.test(pm[2]) ? "UZS" : "USD"; // y.e. = USD-equivalent
  return { id: idm[1], year: ym ? Number(ym[1]) : null, priceRaw: Number.isFinite(priceRaw) ? priceRaw : null, currency };
}

async function main() {
  const env = loadEnv();
  const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!U) { log.error("missing Supabase env"); process.exit(1); }
  const H = { apikey: K, authorization: `Bearer ${K}` };

  // Catalog → brand → [models]. Marketplaces use the base model name ("H6") while
  // the catalog often carries trim suffixes ("H6 2.0T", "H6 HEV"), so match on the
  // model's *significant* tokens (drop trim noise) — a caption matches a catalog
  // model when ALL its significant tokens appear. Most-specific (most tokens) wins.
  const TRIM_NOISE = /^(\d(?:\.\d)?t|hev|phev|dm-?i|ev|bev|champion|gt|awd|4wd|2wd|long|range|pro\+?|версия|пакет)$/i;
  const sigTokens = (lc) => lc.split(/[\s/-]+/).filter((t) => t.length >= 2 && !TRIM_NOISE.test(t));
  const cars = await (await fetch(`${U}/rest/v1/cars?select=brand,model&limit=400`, { headers: H })).json();
  const brandModels = new Map();
  for (const c of cars) {
    const b = String(c.brand || "").trim(), m = String(c.model || "").trim();
    if (!b || !m) continue;
    const arr = brandModels.get(b) || [];
    if (!arr.some((x) => x.model === m)) arr.push({ model: m, tokens: sigTokens(m.toLowerCase()) });
    brandModels.set(b, arr);
  }
  // Most-specific first so "Tiggo 8 Pro" beats "Tiggo 8" when both fully match.
  for (const arr of brandModels.values()) arr.sort((a, b) => b.tokens.length - a.tokens.length);
  log.info(`catalog: ${brandModels.size} brands`);

  const listings = [];
  const requests = [];
  for (const brand of brandModels.keys()) {
    const mark = markSlug(brand);
    if (!mark) continue;
    for (let p = 1; p <= PAGES; p++) {
      requests.push({ url: `https://avtoelon.uz/avto/${mark}/?page=${p}`, userData: { brand } });
    }
  }

  const crawler = new HttpCrawler({
    ...baseCrawlerOptions({ maxConcurrency: 2 }),
    preNavigationHooks: [async ({ request }) => { request.headers = { ...request.headers, "user-agent": UA, "accept-language": "ru,en;q=0.8" }; }],
    async requestHandler({ request, body, session }) {
      const brand = request.userData.brand;
      const models = brandModels.get(brand) || [];
      const html = body.toString();
      const alts = altsFrom(html);
      if (alts.length === 0 && session) session.markBad();
      const bl = brand.toLowerCase();
      let n = 0;
      for (const alt of alts) {
        const a = alt.toLowerCase();
        if (!a.includes(bl)) continue;                       // drop other-brand sidebar bleed
        // First catalog model (most-specific) whose every significant token is present.
        const hit = models.find((m) => m.tokens.length > 0 && m.tokens.every((t) => a.includes(t)));
        if (!hit) continue;                                  // model the dealer doesn't track
        const parsed = parseAlt(alt);
        if (!parsed || parsed.priceRaw == null) continue;
        listings.push({
          source: "avtoelon",
          source_ref: `/a/show/${parsed.id}`,
          brand, model: hit.model,
          year: parsed.year,
          price_raw: parsed.priceRaw,
          currency: parsed.currency,
          raw_text: alt.slice(0, 300),
        });
        n++;
      }
      if (n) log.info(`${brand} p${request.userData ? "" : ""}: +${n}`);
    },
    failedRequestHandler({ request }) { log.warning(`failed: ${request.url}`); },
  });

  await crawler.run(requests);
  log.info(`collected ${listings.length} avtoelon listings`);
  const res = await ingestListings("avtoelon", listings);
  log.info(`done — received ${res.received}, stored ${res.stored}`);
}

main().catch((e) => { log.error(e?.stack || String(e)); process.exit(1); });
