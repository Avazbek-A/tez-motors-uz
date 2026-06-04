/**
 * Product-feed generation (Phase AJ — omnichannel distribution).
 *
 * Turns the public car catalog into syndication feeds so inventory reaches
 * buyers OFF the website: Google Merchant (shopping ads), Meta catalog
 * (Facebook/Instagram shops), and OLX.uz autoload (the dominant UZ classifieds
 * import format). All read-only, public, cached. No external creds — the dealer
 * points each platform at the feed URL.
 *
 * Pure builders (buildGoogleFeed / buildMetaCsv / buildOlxFeed) take an array of
 * FeedCar so they're unit-testable; the routes do the (anon, RLS-gated) read.
 */
import { escapeHtml } from "./escape-html";
import { SITE_CONFIG } from "./constants";

export interface FeedCar {
  id: string;
  slug: string;
  brand: string;
  model: string;
  year: number | null;
  price_usd: number | null;
  description_ru: string | null;
  description_en: string | null;
  images: string[] | null;
  thumbnail: string | null;
  listing_type: string | null; // 'new' | 'used'
  body_type: string | null;
  fuel_type: string | null;
  color: string | null;
  mileage: number | null;
}

const BASE = SITE_CONFIG.url.replace(/\/$/, "");

/** Columns a feed needs — a subset of PUBLIC_CAR_COLUMNS. */
export const FEED_CAR_COLUMNS =
  "id, slug, brand, model, year, price_usd, description_ru, description_en, images, thumbnail, listing_type, body_type, fuel_type, color, mileage";

export function carTitle(c: FeedCar): string {
  return [c.brand, c.model, c.year].filter(Boolean).join(" ");
}

export function carLink(c: FeedCar, locale = "ru", channel?: string): string {
  const u = `${BASE}/${locale}/catalog/${encodeURIComponent(c.slug)}`;
  // utm so leads from the feed attribute back (src/lib/attribution.ts reads them).
  if (!channel) return u;
  return `${u}?utm_source=${channel}&utm_medium=feed&utm_campaign=catalog`;
}

export function carImage(c: FeedCar): string | null {
  if (c.thumbnail) return c.thumbnail;
  if (Array.isArray(c.images) && c.images[0]) return c.images[0];
  return null;
}

function condition(c: FeedCar): "new" | "used" {
  return c.listing_type === "used" ? "used" : "new";
}

function descriptionFor(c: FeedCar): string {
  const d = c.description_ru || c.description_en || carTitle(c);
  // Feeds cap descriptions; keep it well under Google's 5000-char limit.
  return d.slice(0, 4000);
}

/** Google Merchant / RSS 2.0 product feed. */
export function buildGoogleFeed(cars: FeedCar[], locale = "ru"): string {
  const items = cars
    .filter((c) => c.price_usd && carImage(c))
    .map((c) => {
      const img = carImage(c)!;
      return `    <item>
      <g:id>${escapeHtml(c.id)}</g:id>
      <g:title>${escapeHtml(carTitle(c))}</g:title>
      <g:description>${escapeHtml(descriptionFor(c))}</g:description>
      <g:link>${escapeHtml(carLink(c, locale, "google"))}</g:link>
      <g:image_link>${escapeHtml(img)}</g:image_link>
      <g:availability>in_stock</g:availability>
      <g:condition>${condition(c)}</g:condition>
      <g:price>${Math.round(Number(c.price_usd))} USD</g:price>
      <g:brand>${escapeHtml(c.brand)}</g:brand>
      <g:google_product_category>916</g:google_product_category>
      <g:identifier_exists>no</g:identifier_exists>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeHtml(SITE_CONFIG.name)} — catalog</title>
    <link>${escapeHtml(BASE)}</link>
    <description>${escapeHtml(SITE_CONFIG.description)}</description>
${items}
  </channel>
</rss>`;
}

/** Meta (Facebook/Instagram) catalog CSV. */
export function buildMetaCsv(cars: FeedCar[], locale = "ru"): string {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const header = "id,title,description,availability,condition,price,link,image_link,brand";
  const rows = cars
    .filter((c) => c.price_usd && carImage(c))
    .map((c) =>
      [
        esc(c.id),
        esc(carTitle(c)),
        esc(descriptionFor(c)),
        "in stock",
        condition(c),
        esc(`${Math.round(Number(c.price_usd))} USD`),
        esc(carLink(c, locale, "meta")),
        esc(carImage(c)!),
        esc(c.brand),
      ].join(","),
    );
  return [header, ...rows].join("\n");
}

/** OLX.uz autoload XML (simplified ad-import schema). */
export function buildOlxFeed(cars: FeedCar[], locale = "ru"): string {
  const ads = cars
    .filter((c) => c.price_usd && carImage(c))
    .map((c) => {
      const imgs = (Array.isArray(c.images) ? c.images : [carImage(c)!])
        .filter(Boolean)
        .slice(0, 8)
        .map((u) => `        <image>${escapeHtml(u)}</image>`)
        .join("\n");
      return `    <ad>
      <id>${escapeHtml(c.id)}</id>
      <title>${escapeHtml(carTitle(c))}</title>
      <description>${escapeHtml(descriptionFor(c))}</description>
      <category>cars</category>
      <price>${Math.round(Number(c.price_usd))}</price>
      <currency>USD</currency>
      <url>${escapeHtml(carLink(c, locale, "olx"))}</url>
      <brand>${escapeHtml(c.brand)}</brand>
      <model>${escapeHtml(c.model)}</model>
      ${c.year ? `<year>${c.year}</year>` : ""}
      ${c.mileage != null ? `<mileage>${Math.round(c.mileage)}</mileage>` : ""}
      <condition>${condition(c)}</condition>
      <images>
${imgs}
      </images>
    </ad>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<ads>
${ads}
</ads>`;
}
