import { defaultLocale, locales, type Locale } from "@/i18n/config";

export function stripLocalePrefix(pathname: string): string {
  const match = pathname.match(/^\/(ru|uz|en)(\/.*)?$/);
  if (!match) return pathname;
  return match[2] || "/";
}

export function getLocaleFromPathname(pathname: string): Locale | null {
  const match = pathname.match(/^\/(ru|uz|en)(\/|$)/);
  return match ? (match[1] as Locale) : null;
}

export function localizedPath(locale: Locale, pathname: string): string {
  const bare = stripLocalePrefix(pathname);
  if (bare === "/") return `/${locale}`;
  return `/${locale}${bare}`;
}

export function detectBestLocale(headerValue: string | null | undefined): Locale {
  const value = (headerValue || "").toLowerCase();
  for (const locale of locales) {
    if (value.includes(locale)) return locale;
  }
  return defaultLocale;
}
