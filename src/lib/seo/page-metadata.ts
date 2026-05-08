import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { getLocaleFromCookie } from "@/i18n/config";
import { localizedAlternates, type SeoLocale } from "@/lib/seo/alternates";

type LocaleCopy = { title: string; description: string };

/**
 * Build a `Metadata` object for a static marketing page in all 3 locales.
 *
 * Pass localized title/description for each locale plus the path (without
 * locale prefix). Canonical + hreflang alternates are wired automatically.
 */
export async function makePageMetadata(
  path: string,
  copy: Record<SeoLocale, LocaleCopy>,
): Promise<Metadata> {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as SeoLocale | null) ??
    (getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value) as SeoLocale);

  const c = copy[locale] ?? copy.ru;

  return {
    title: c.title,
    description: c.description,
    alternates: localizedAlternates(path, locale),
    openGraph: { title: c.title, description: c.description },
  };
}
