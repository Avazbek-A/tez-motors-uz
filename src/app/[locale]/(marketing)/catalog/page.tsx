import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import CatalogContentWrapper from "./_content";
import { getLocaleFromCookie } from "@/i18n/config";
import { SITE_CONFIG } from "@/lib/constants";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as "ru" | "uz" | "en" | null) ??
    getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value);

  const title =
    locale === "uz"
      ? "Xitoy avtomobillari katalogi — Tez Motors"
      : locale === "en"
      ? "China Car Catalog — Tez Motors"
      : "Каталог авто из Китая — Tez Motors";
  const description =
    locale === "uz"
      ? "BYD, Haval, Chery, Geely va boshqa brendlar. Yangilangan narxlar va xususiyatlar."
      : locale === "en"
      ? "BYD, Haval, Chery, Geely and more. Current prices and specs."
      : "BYD, Haval, Chery, Geely и другие бренды. Актуальные цены и характеристики. Импорт автомобилей из Китая в Узбекистан.";

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_CONFIG.url}/${locale}/catalog`,
      languages: {
        ru: `${SITE_CONFIG.url}/ru/catalog`,
        uz: `${SITE_CONFIG.url}/uz/catalog`,
        en: `${SITE_CONFIG.url}/en/catalog`,
      },
    },
  };
}

export default function CatalogPage() {
  return <CatalogContentWrapper />;
}
