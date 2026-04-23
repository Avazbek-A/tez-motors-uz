import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { SITE_CONFIG } from "@/lib/constants";
import { getLocaleFromCookie } from "@/i18n/config";
import PartsCatalogContent from "./_content";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as "ru" | "uz" | "en" | null) ??
    getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value);

  const title =
    locale === "uz"
      ? "Ehtiyot qismlar katalogi — Tez Motors"
      : locale === "en"
      ? "Spare Parts Catalog — Tez Motors"
      : "Каталог запчастей — Tez Motors";
  const description =
    locale === "uz"
      ? "Xitoy avtomobillari uchun OEM va analog ehtiyot qismlar."
      : locale === "en"
      ? "OEM and aftermarket spare parts for Chinese cars. Filter by category, brand, or vehicle."
      : "OEM и аналоговые запчасти для китайских авто. Фильтр по категории, марке и модели.";

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_CONFIG.url}/${locale}/parts`,
      languages: {
        ru: `${SITE_CONFIG.url}/ru/parts`,
        uz: `${SITE_CONFIG.url}/uz/parts`,
        en: `${SITE_CONFIG.url}/en/parts`,
      },
    },
    openGraph: { title, description },
  };
}

export default function PartsPage() {
  return <PartsCatalogContent />;
}
