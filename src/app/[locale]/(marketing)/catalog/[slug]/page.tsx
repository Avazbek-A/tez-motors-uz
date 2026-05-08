import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SITE_CONFIG } from "@/lib/constants";
import CarDetailClient from "./car-detail-client";
import { getLocaleFromCookie } from "@/i18n/config";
import { BreadcrumbSchema } from "@/components/shared/breadcrumb-schema";

async function fetchCar(slug: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("cars")
      .select("brand, model, year, price_usd, description_ru, description_en, slug, images")
      .eq("slug", slug)
      .maybeSingle();
    return data;
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
  const car = await fetchCar(slug);
  if (!car) {
    return { title: "Car not found" };
  }
  const title = `${car.brand} ${car.model} ${car.year}`;
  const price = car.price_usd ? ` — $${car.price_usd.toLocaleString()}` : "";
  const description =
    car.description_ru ||
    car.description_en ||
    `Import ${car.brand} ${car.model} ${car.year} from China to Uzbekistan. Transparent pricing, full support.`;
    const image = Array.isArray(car.images) && car.images[0] ? car.images[0] : `${SITE_CONFIG.url}/opengraph-image`;

  return {
    title: `${title}${price}`,
    description,
      openGraph: {
        title: `${title}${price}`,
        description,
        images: [{ url: image }],
      },
      twitter: {
        card: "summary_large_image",
        title: `${title}${price}`,
        description,
        images: [image],
    },
    alternates: {
      canonical: `${SITE_CONFIG.url}/${locale}/catalog/${slug}`,
      languages: {
        ru: `${SITE_CONFIG.url}/ru/catalog/${slug}`,
        uz: `${SITE_CONFIG.url}/uz/catalog/${slug}`,
          en: `${SITE_CONFIG.url}/en/catalog/${slug}`,
        },
      },
    };
  }

export default async function Page(
  { params }: { params: Promise<{ slug: string }> },
) {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as "ru" | "uz" | "en" | null) ??
    getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value);
  const { slug } = await params;
  const car = await fetchCar(slug);

  return (
    <>
      <CarDetailClient />
      {car && (
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
              name: car.brand,
              url: `${SITE_CONFIG.url}/${locale}/catalog/brand/${car.brand.toLowerCase()}`,
            },
            {
              name: `${car.brand} ${car.model} ${car.year}`,
              url: `${SITE_CONFIG.url}/${locale}/catalog/${slug}`,
            },
          ]}
        />
      )}
    </>
  );
}
