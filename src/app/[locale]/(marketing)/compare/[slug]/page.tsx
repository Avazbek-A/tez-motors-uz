import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SITE_CONFIG } from "@/lib/constants";
import { getLocaleFromCookie } from "@/i18n/config";
import { localizedAlternates, type SeoLocale } from "@/lib/seo/alternates";
import { BreadcrumbSchema } from "@/components/shared/breadcrumb-schema";
import CompareContent from "../_content";

/**
 * Canonical compare URL: /compare/[carA-slug]-vs-[carB-slug].
 *
 * Uses car slugs (already unique + stable) to avoid the brand-model
 * parsing brittleness called out in Phase L3. The page resolves both
 * slugs, sets per-pair metadata, and renders the same comparison UI as
 * `/compare?ids=…`.
 */

const SEPARATOR = "-vs-";

function parsePairSlug(slug: string): [string, string] | null {
  const idx = slug.indexOf(SEPARATOR);
  if (idx <= 0 || idx >= slug.length - SEPARATOR.length) return null;
  const left = slug.slice(0, idx);
  const right = slug.slice(idx + SEPARATOR.length);
  if (!left || !right) return null;
  return [left, right];
}

async function fetchCarsBySlugs(slugs: string[]) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("cars")
      .select("id, slug, brand, model, year")
      .in("slug", slugs);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const pair = parsePairSlug(slug);
  if (!pair) return { title: "Compare not found" };

  const cars = await fetchCarsBySlugs(pair);
  if (cars.length !== 2) return { title: "Compare not found" };

  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as SeoLocale | null) ??
    (getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value) as SeoLocale);

  const [a, b] = pair.map((s) => cars.find((c) => c.slug === s)!).filter(Boolean);
  if (!a || !b) return { title: "Compare not found" };

  const heading = `${a.brand} ${a.model} ${a.year} vs ${b.brand} ${b.model} ${b.year}`;
  const title = locale === "ru"
    ? `${heading} — сравнение | Tez Motors`
    : locale === "uz"
    ? `${heading} — taqqoslash | Tez Motors`
    : `${heading} — comparison | Tez Motors`;
  const description = locale === "ru"
    ? `Подробное сравнение ${heading}: цены, характеристики, расход. Импорт под ключ Tez Motors.`
    : locale === "uz"
    ? `${heading} — narxlar, xususiyatlar, sarf solishtirilishi. Tez Motors import.`
    : `Side-by-side comparison of ${heading}: prices, specs, fuel use. Tez Motors imports.`;

  return {
    title,
    description,
    alternates: localizedAlternates(`/compare/${slug}`, locale),
    openGraph: { title, description },
  };
}

export default async function ComparePairPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const pair = parsePairSlug(slug);
  if (!pair) notFound();

  const cars = await fetchCarsBySlugs(pair);
  if (cars.length !== 2) notFound();

  const ordered = pair.map((s) => cars.find((c) => c.slug === s)!).filter(Boolean);
  if (ordered.length !== 2) notFound();
  const [a, b] = ordered;

  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as SeoLocale | null) ??
    (getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value) as SeoLocale);

  const heading = `${a.brand} ${a.model} ${a.year} vs ${b.brand} ${b.model} ${b.year}`;

  return (
    <>
      <BreadcrumbSchema
        items={[
          {
            name: locale === "ru" ? "Главная" : locale === "uz" ? "Bosh sahifa" : "Home",
            url: `${SITE_CONFIG.url}/${locale}`,
          },
          {
            name: locale === "ru" ? "Сравнение" : locale === "uz" ? "Taqqoslash" : "Compare",
            url: `${SITE_CONFIG.url}/${locale}/compare`,
          },
          {
            name: heading,
            url: `${SITE_CONFIG.url}/${locale}/compare/${slug}`,
          },
        ]}
      />
      <Suspense
        fallback={
          <div className="pt-32 pb-16 text-center container-custom">
            <Loader2 className="w-8 h-8 animate-spin text-neon-blue mx-auto mb-3" />
          </div>
        }
      >
        <CompareContent initialIds={[a.id, b.id]} />
      </Suspense>
    </>
  );
}
