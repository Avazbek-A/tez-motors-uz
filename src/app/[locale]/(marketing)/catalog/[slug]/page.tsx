import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SITE_CONFIG } from "@/lib/constants";
import CarDetailClient from "./car-detail-client";
import { getLocaleFromCookie } from "@/i18n/config";
import { BreadcrumbSchema } from "@/components/shared/breadcrumb-schema";
import { CarSchema } from "@/components/shared/structured-data";

async function fetchCar(slug: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("cars")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

async function fetchAggregate(carId: string | null) {
  if (!carId) return null;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("reviews")
      .select("rating")
      .eq("car_id", carId)
      .eq("is_published", true);
    if (!data || data.length === 0) return null;
    const ratings = data
      .map((r: { rating: number | null }) => r.rating)
      .filter((n): n is number => typeof n === "number");
    if (ratings.length === 0) return null;
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    return { ratingValue: avg, count: ratings.length };
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
  const aggregate = await fetchAggregate(car?.id ?? null);

  return (
    <>
      <CarDetailClient />
      {car && <CarSchema car={car} aggregate={aggregate} />}
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
