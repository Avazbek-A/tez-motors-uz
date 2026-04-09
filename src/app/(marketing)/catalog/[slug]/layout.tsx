import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SITE_CONFIG } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";

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
      .select("brand, model, year, price_usd, description_ru, fuel_type, body_type, images, thumbnail")
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

    const imageUrl = car.thumbnail || car.images?.[0] || `${SITE_CONFIG.url}/images/og-car.jpg`;

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
    const supabase = await createClient();
    const { data: car } = await supabase
      .from("cars")
      .select("*")
      .eq("slug", slug)
      .single();

    if (!car) return null;

    const schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: `${car.brand} ${car.model} ${car.year}`,
      description: car.description_ru || `${car.brand} ${car.model} ${car.year} — купить из Китая`,
      image: car.images?.[0] || car.thumbnail,
      brand: { "@type": "Brand", name: car.brand },
      offers: {
        "@type": "Offer",
        price: car.price_usd,
        priceCurrency: "USD",
        availability: car.is_available
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        url: `${SITE_CONFIG.url}/catalog/${slug}`,
        seller: { "@type": "Organization", name: SITE_CONFIG.name },
      },
      vehicleConfiguration: car.transmission,
      fuelType: car.fuel_type,
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
