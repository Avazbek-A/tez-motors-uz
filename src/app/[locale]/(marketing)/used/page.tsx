import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { SITE_CONFIG } from "@/lib/constants";
import { getLocaleFromCookie } from "@/i18n/config";
import { localizedAlternates, type SeoLocale } from "@/lib/seo/alternates";
import { BreadcrumbSchema } from "@/components/shared/breadcrumb-schema";
import CatalogContent from "../catalog/_content";

/**
 * Used-car (pre-owned) section: /used. Mirrors the brand-landing pattern —
 * its own canonical URL + h1 + intro for "купить б/у авто Ташкент" intent —
 * and reuses the catalog grid pinned to listing_type='used' via initialFilters.
 */
const COPY: Record<SeoLocale, { title: string; description: string; intro: string }> = {
  ru: {
    title: "Авто с пробегом в Ташкенте — Tez Motors",
    description: "Проверенные автомобили с пробегом от Tez Motors: реальный пробег, история, гарантия чистоты сделки. Актуальные цены, рассрочка, обмен (trade-in).",
    intro: "Проверенные автомобили с пробегом. Каждая машина проходит диагностику; указываем реальный пробег, число владельцев и состояние. Возможен обмен по trade-in и рассрочка.",
  },
  uz: {
    title: "Probegi bor avtomobillar Toshkentda — Tez Motors",
    description: "Tez Motors’dan tekshirilgan probegli avtomobillar: haqiqiy probeg, tarix, kafolat. Narxlar, bo‘lib to‘lash va trade-in.",
    intro: "Tekshirilgan probegli avtomobillar. Har bir mashina diagnostikadan o‘tadi; haqiqiy probeg, egalar soni va holatini ko‘rsatamiz. Trade-in va bo‘lib to‘lash mavjud.",
  },
  en: {
    title: "Used cars in Tashkent — Tez Motors",
    description: "Inspected pre-owned cars from Tez Motors: real mileage, history, an honest deal. Live prices, installments, trade-in welcome.",
    intro: "Inspected pre-owned cars. Each is checked; we list real mileage, number of owners, and condition. Trade-in and installments available.",
  },
};

function resolveLocale(h: Headers, c: { get(n: string): { value: string } | undefined }): SeoLocale {
  return (h.get("x-tez-locale") as SeoLocale | null) ?? (getLocaleFromCookie(c.get("NEXT_LOCALE")?.value) as SeoLocale);
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale(await headers(), await cookies());
  const c = COPY[locale];
  return {
    title: c.title,
    description: c.description,
    alternates: localizedAlternates("/used", locale),
    openGraph: { title: c.title, description: c.description },
  };
}

export default async function UsedCarsPage() {
  const locale = resolveLocale(await headers(), await cookies());
  const c = COPY[locale];
  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: locale === "ru" ? "Главная" : locale === "uz" ? "Bosh sahifa" : "Home", url: `${SITE_CONFIG.url}/${locale}` },
          { name: c.title, url: `${SITE_CONFIG.url}/${locale}/used` },
        ]}
      />
      <div className="pt-24">
        <div className="container-custom">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gradient">{c.title}</h1>
          <p className="mt-4 text-base md:text-lg text-white/70 max-w-3xl">{c.intro}</p>
        </div>
      </div>
      <CatalogContent initialFilters={{ listing_type: "used" }} basePath="/used" />
    </>
  );
}
