import { SITE_CONFIG } from "@/lib/constants";

const LOCALES = ["ru", "uz", "en"] as const;
export type SeoLocale = (typeof LOCALES)[number];

/**
 * Build canonical + hreflang alternates for a page.
 *
 * - `path` is the path WITHOUT a locale prefix, e.g. "/about" or "/parts/abc".
 *   Pass an empty string for the homepage.
 * - `locale` is the locale of the *current* request. The canonical URL points
 *   at the locale-prefixed version of the page; `languages` covers all three
 *   so Google can pick the best alternate per visitor.
 *
 * Wrong hreflang (canonical pointing to a different locale) is worse than
 * none — keep this helper as the single source of truth.
 */
export function localizedAlternates(path: string, locale: SeoLocale) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const trimmed = clean === "/" ? "" : clean;
  return {
    canonical: `${SITE_CONFIG.url}/${locale}${trimmed}`,
    languages: Object.fromEntries(
      LOCALES.map((l) => [l, `${SITE_CONFIG.url}/${l}${trimmed}`]),
    ) as Record<SeoLocale, string>,
  };
}
