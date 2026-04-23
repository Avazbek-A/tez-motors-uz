import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import CarDetailClient from "./car-detail-client";

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
  const image = Array.isArray(car.images) && car.images[0] ? car.images[0] : undefined;

  return {
    title: `${title}${price}`,
    description,
    openGraph: {
      title: `${title}${price}`,
      description,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title}${price}`,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default function Page() {
  return <CarDetailClient />;
}
