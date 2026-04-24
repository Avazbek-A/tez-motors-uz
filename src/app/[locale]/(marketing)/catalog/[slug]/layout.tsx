import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SITE_CONFIG } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";
import { getLocaleFromCookie } from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const supabase = await createClient();
    const { data: car } = await supabase
      .from("cars")
      .select("brand, model, year, price_usd, original_price_usd, description_ru, fuel_type, body_type, images, thumbnail, transmission, engine_volume, engine_power, inventory_status")
      .eq("slug", slug)
      .single();

    if (!car) {
      return {
        title: "Автомобиль не найден",
        description: "Данный автомобиль не найден в каталоге Tez Motors.",
      };
    }

    const title = `${car.brand} ${car.model} ${car.year} — ${formatPrice(car.price_usd)}`;
    const description =
      car.description_ru ||
      `${car.brand} ${car.model} ${car.year} — купить из Китая в Узбекистан. ` +
        `${formatPrice(car.price_usd)}. ${car.body_type}, ${car.fuel_type}. Tez Motors.`;

    const imageUrl = car.thumbnail || car.images?.[0] || `${SITE_CONFIG.url}/opengraph-image`;

    return {
      title,
      description,
      openGraph: {
        title: `${title} | Tez Motors`,
        description,
        type: "website",
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: `${car.brand} ${car.model} ${car.year}`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: `${title} | Tez Motors`,
        description,
        images: [imageUrl],
      },
      alternates: {
        canonical: `${SITE_CONFIG.url}/catalog/${slug}`,
        languages: {
          ru: `${SITE_CONFIG.url}/ru/catalog/${slug}`,
          uz: `${SITE_CONFIG.url}/uz/catalog/${slug}`,
          en: `${SITE_CONFIG.url}/en/catalog/${slug}`,
        },
      },
    };
  } catch {
    return {
      title: "Автомобиль из Китая",
      description: "Импорт автомобилей из Китая в Узбекистан. Tez Motors.",
    };
  }
}

async function CarDetailSchemaInjector({ slug }: { slug: string }) {
  try {
    const requestHeaders = await headers();
    const cookieStore = await cookies();
    const locale =
      (requestHeaders.get("x-tez-locale") as "ru" | "uz" | "en" | null) ??
      getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value);
    const supabase = await createClient();
    const { data: car } = await supabase
      .from("cars")
      .select("*")
      .eq("slug", slug)
      .single();

    if (!car) return null;

    const schema = {
      "@context": "https://schema.org",
      "@type": "Vehicle",
      name: `${car.brand} ${car.model} ${car.year}`,
      description: car.description_ru || `${car.brand} ${car.model} ${car.year} — купить из Китая`,
      image: car.images?.[0] || car.thumbnail,
      brand: { "@type": "Brand", name: car.brand },
      model: car.model,
      vehicleModelDate: String(car.year),
      vehicleConfiguration: car.transmission,
      fuelType: car.fuel_type,
      offers: {
        "@type": "Offer",
        price: car.price_usd,
        priceCurrency: "USD",
        availability: car.is_available
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        url: `${SITE_CONFIG.url}/${locale}/catalog/${slug}`,
        seller: { "@type": "Organization", name: SITE_CONFIG.name },
      },
      modelDate: String(car.year),
      ...(car.engine_volume && {
        vehicleEngine: {
          "@type": "EngineSpecification",
          displacement: `${car.engine_volume}L`,
          ...(car.engine_power && { enginePower: `${car.engine_power} hp` }),
        },
      }),
    };

    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    );
  } catch {
    return null;
  }
}

export default async function CarDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <>
      <CarDetailSchemaInjector slug={slug} />
      {children}
    </>
  );
}
