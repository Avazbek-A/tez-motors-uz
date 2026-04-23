import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import Script from "next/script";
import { SITE_CONFIG } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { getLocaleFromCookie } from "@/i18n/config";
import PartDetailClient from "./part-detail-client";
import type { Part } from "@/types/part";

async function fetchPart(slug: string): Promise<Part | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("parts")
      .select("*")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
    return (data as Part | null) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as "ru" | "uz" | "en" | null) ??
    getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value);
  const { slug } = await params;
  const part = await fetchPart(slug);
  if (!part) return { title: "Not found" };

  const name =
    (locale === "uz" && part.name_uz) ||
    (locale === "en" && part.name_en) ||
    part.name_ru;
  const titleBase = part.oem_number ? `${name} — OEM ${part.oem_number}` : name;
  const description =
    part.description_ru ||
    part.description_en ||
    `${name} — ${part.brand || "OEM"} spare part. Tez Motors Uzbekistan.`;
  const image =
    Array.isArray(part.images) && part.images[0]
      ? part.images[0]
      : `${SITE_CONFIG.url}/opengraph-image`;

  return {
    title: titleBase,
    description,
    openGraph: { title: titleBase, description, images: [{ url: image }] },
    twitter: { card: "summary_large_image", title: titleBase, description, images: [image] },
    alternates: {
      canonical: `${SITE_CONFIG.url}/${locale}/parts/${slug}`,
      languages: {
        ru: `${SITE_CONFIG.url}/ru/parts/${slug}`,
        uz: `${SITE_CONFIG.url}/uz/parts/${slug}`,
        en: `${SITE_CONFIG.url}/en/parts/${slug}`,
      },
    },
  };
}

export default async function PartDetailPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const part = await fetchPart(slug);
  if (!part) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: part.name_ru,
    sku: part.oem_number || part.slug,
    brand: part.brand ? { "@type": "Brand", name: part.brand } : undefined,
    image: part.images,
    description: part.description_ru || undefined,
    offers: part.price_usd
      ? {
          "@type": "Offer",
          priceCurrency: "USD",
          price: String(part.price_usd),
          availability:
            part.stock_qty > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/PreOrder",
          url: `${SITE_CONFIG.url}/parts/${part.slug}`,
        }
      : undefined,
  };

  return (
    <>
      <Script
        id={`jsonld-part-${part.id}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PartDetailClient part={part} />
    </>
  );
}
