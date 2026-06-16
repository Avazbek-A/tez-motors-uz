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
const COPY: Record<SeoLocale, { title: string; description: string; intro: string; disclaimer: string }> = {
  ru: {
    title: "Авто с пробегом в Узбекистане — цены и объявления",
    description: "Объявления о продаже автомобилей с пробегом в Узбекистане в одном месте: марки, годы, пробег и актуальные цены. Удобный поиск и сравнение на Tez Motors.",
    intro: "Объявления о продаже авто с пробегом, собранные с открытых площадок Узбекистана. Сравнивайте марки, годы, пробег и цены в одном каталоге — а оформить покупку, рассрочку или trade-in поможем мы.",
    disclaimer: "Это рыночные объявления, агрегированные с открытых площадок (OLX). Они не являются собственным инвентарём Tez Motors и не проходили нашу проверку — уточняйте состояние и наличие у продавца по ссылке на источник.",
  },
  uz: {
    title: "Probegi bor avtomobillar O‘zbekistonda — narxlar va e’lonlar",
    description: "O‘zbekistonda probegli avtomobillar e’lonlari bir joyda: rusum, yil, probeg va narxlar. Tez Motors’da qulay qidiruv va taqqoslash.",
    intro: "Ochiq maydonchalardan yig‘ilgan probegli avtomobillar e’lonlari. Rusum, yil, probeg va narxlarni bitta katalogda taqqoslang — xaridni, bo‘lib to‘lash yoki trade-in’ni biz rasmiylashtirib beramiz.",
    disclaimer: "Bu — ochiq maydonchalardan (OLX) yig‘ilgan bozor e’lonlari. Ular Tez Motors’ning shaxsiy inventari emas va biz tomonidan tekshirilmagan — holati va mavjudligini manba havolasi orqali sotuvchidan aniqlang.",
  },
  en: {
    title: "Used cars in Uzbekistan — prices & listings",
    description: "Used-car listings across Uzbekistan in one place: makes, years, mileage and live prices. Easy search and comparison on Tez Motors.",
    intro: "Used-car listings aggregated from open marketplaces across Uzbekistan. Compare makes, years, mileage and prices in one catalogue — and we’ll help you with the purchase, financing or trade-in.",
    disclaimer: "These are market listings aggregated from open marketplaces (OLX). They are not Tez Motors’ own inventory and have not been inspected by us — confirm condition and availability with the seller via the source link.",
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
          <p className="mt-4 text-xs md:text-sm text-white/40 max-w-3xl border-l-2 border-white/10 pl-3">{c.disclaimer}</p>
        </div>
      </div>
      <CatalogContent initialFilters={{ listing_type: "used" }} basePath="/used" />
    </>
  );
}
