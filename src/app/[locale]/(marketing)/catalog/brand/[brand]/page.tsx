import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { SITE_CONFIG } from "@/lib/constants";
import { brandSlug, getInventoryBrands, brandFromSlug } from "@/lib/brands";
import { getLocaleFromCookie } from "@/i18n/config";
import { localizedAlternates, type SeoLocale } from "@/lib/seo/alternates";
import { BreadcrumbSchema } from "@/components/shared/breadcrumb-schema";
import CatalogContent from "../../_content";

/**
 * Brand landing page: /catalog/brand/[brand].
 *
 * Each brand gets its own canonical URL, title, description, and h1 so
 * Google can rank it independently for brand-led queries ("BYD в
 * Ташкенте"). The body is the standard catalog grid pre-filtered to that
 * brand, so filter/search interactions still work as expected. The brand list
 * is derived from live inventory (every in-stock brand → its own page), with
 * URL-safe slugs (brandSlug handles spaces / "&" e.g. Lynk&Co → lynk-co).
 */

const COPY_BY_LOCALE: Record<
  SeoLocale,
  (brand: string) => { title: string; description: string; intro: string }
> = {
  ru: (brand) => ({
    title: `${brand} в Ташкенте — каталог Tez Motors`,
    description: `Купить ${brand} в Узбекистане под ключ. Tez Motors импортирует ${brand} из Китая: подбор, доставка, таможня, гарантия. Актуальные цены и характеристики.`,
    intro: `Все модели ${brand} в наличии и под заказ. Импортируем напрямую с заводов в Китае, оформляем таможню, доставляем по всему Узбекистану. Прозрачные цены без скрытых наценок.`,
  }),
  uz: (brand) => ({
    title: `${brand} Toshkentda — Tez Motors katalogi`,
    description: `${brand} avtomobillarini Toshkentda sotib oling. Tez Motors Xitoydan ${brand} import qiladi: tanlash, yetkazib berish, bojxona, kafolat.`,
    intro: `Barcha ${brand} modellari mavjud va buyurtma asosida. Xitoyning zavodlaridan to'g'ridan-to'g'ri import qilamiz, bojxonadan o'tkazamiz, butun O'zbekiston bo'ylab yetkazamiz.`,
  }),
  en: (brand) => ({
    title: `${brand} in Tashkent — Tez Motors catalog`,
    description: `Buy ${brand} in Uzbekistan turn-key. Tez Motors imports ${brand} from China: sourcing, delivery, customs, warranty. Live prices and specs.`,
    intro: `All ${brand} models in stock and on order. We import direct from Chinese factories, handle customs, and deliver across Uzbekistan. Transparent pricing, no hidden fees.`,
  }),
};

export async function generateStaticParams() {
  const brands = await getInventoryBrands();
  return brands.map((b) => ({ brand: brandSlug(b) }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ brand: string }> },
): Promise<Metadata> {
  const { brand: slug } = await params;
  const brand = await brandFromSlug(slug);
  if (!brand) return { title: "Brand not found" };

  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as SeoLocale | null) ??
    (getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value) as SeoLocale);

  const c = COPY_BY_LOCALE[locale](brand);

  return {
    title: c.title,
    description: c.description,
    alternates: localizedAlternates(`/catalog/brand/${slug}`, locale),
    openGraph: { title: c.title, description: c.description },
  };
}

export default async function BrandPage(
  { params }: { params: Promise<{ brand: string }> },
) {
  const { brand: slug } = await params;
  const brand = await brandFromSlug(slug);
  if (!brand) notFound();

  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as SeoLocale | null) ??
    (getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value) as SeoLocale);

  const c = COPY_BY_LOCALE[locale](brand);

  return (
    <>
      <BreadcrumbSchema
        items={[
          {
            name: locale === "ru" ? "Главная" : locale === "uz" ? "Bosh sahifa" : "Home",
            url: `${SITE_CONFIG.url}/${locale}`,
          },
          {
            name: locale === "ru" ? "Каталог" : locale === "uz" ? "Katalog" : "Catalog",
            url: `${SITE_CONFIG.url}/${locale}/catalog`,
          },
          {
            name: brand,
            url: `${SITE_CONFIG.url}/${locale}/catalog/brand/${slug}`,
          },
        ]}
      />
      <div className="pt-24">
        <div className="container-custom">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gradient">
            {c.title}
          </h1>
          <p className="mt-4 text-base md:text-lg text-white/70 max-w-3xl">
            {c.intro}
          </p>
        </div>
      </div>
      <CatalogContent
        initialFilters={{ brand }}
        basePath={`/catalog/brand/${slug}`}
      />
    </>
  );
}
