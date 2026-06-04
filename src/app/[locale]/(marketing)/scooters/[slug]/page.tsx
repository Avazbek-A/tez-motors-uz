import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import Script from "next/script";
import { SITE_CONFIG } from "@/lib/constants";
import { jsonLd as toJsonLd } from "@/lib/json-ld";
import { createClient } from "@/lib/supabase/server";
import { getLocaleFromCookie } from "@/i18n/config";
import { localizedAlternates, type SeoLocale } from "@/lib/seo/alternates";
import { BreadcrumbSchema } from "@/components/shared/breadcrumb-schema";
import ScooterDetailClient from "./scooter-detail-client";
import type { Scooter } from "@/types/scooter";

async function fetchScooter(slug: string): Promise<Scooter | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("scooters").select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
    return (data as Scooter | null) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale = (requestHeaders.get("x-tez-locale") as SeoLocale | null) ?? (getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value) as SeoLocale);
  const { slug } = await params;
  const s = await fetchScooter(slug);
  if (!s) return { title: "Not found" };
  const title = `${s.brand} ${s.model}`;
  const description = s.description_ru || s.description_en || `${title} — ${s.kind === "ebike" ? "электровелосипед" : "электросамокат"}. Tez Motors.`;
  const image = Array.isArray(s.images) && s.images[0] ? s.images[0] : `${SITE_CONFIG.url}/opengraph-image`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    alternates: localizedAlternates(`/scooters/${slug}`, locale),
  };
}

export default async function ScooterDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale = (requestHeaders.get("x-tez-locale") as SeoLocale | null) ?? (getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value) as SeoLocale);
  const { slug } = await params;
  const s = await fetchScooter(slug);
  if (!s) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${s.brand} ${s.model}`,
    sku: s.slug,
    brand: { "@type": "Brand", name: s.brand },
    image: s.images,
    description: s.description_ru || undefined,
    offers: s.price_usd
      ? { "@type": "Offer", priceCurrency: "USD", price: String(s.price_usd), availability: s.stock_qty > 0 ? "https://schema.org/InStock" : "https://schema.org/PreOrder", url: `${SITE_CONFIG.url}/scooters/${s.slug}` }
      : undefined,
  };

  return (
    <>
      <Script id={`jsonld-scooter-${s.id}`} type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(jsonLd) }} />
      <BreadcrumbSchema
        items={[
          { name: locale === "ru" ? "Главная" : locale === "uz" ? "Bosh sahifa" : "Home", url: `${SITE_CONFIG.url}/${locale}` },
          { name: locale === "ru" ? "Самокаты" : locale === "uz" ? "Skuterlar" : "Scooters", url: `${SITE_CONFIG.url}/${locale}/scooters` },
          { name: `${s.brand} ${s.model}`, url: `${SITE_CONFIG.url}/${locale}/scooters/${s.slug}` },
        ]}
      />
      <ScooterDetailClient scooter={s} />
    </>
  );
}
