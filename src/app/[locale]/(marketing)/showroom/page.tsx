import { createClient } from "@/lib/supabase/server";
import { scrubCarsForPublic } from "@/lib/cars-query";
import { PUBLIC_CAR_COLUMNS } from "@/lib/car-columns";
import type { Car } from "@/types/car";
import { ShowroomContent, type ShowroomCar } from "./_content";

/**
 * Public "virtual showroom" portal: a real 360° walkthrough of in-stock cars
 * (reuses the AutoHome <Car360> viewer) paired with the trade-in lead form.
 * Replaces the old fake /calls/customer "XR portal" demo.
 */
export default async function ShowroomPage() {
  const supabase = await createClient();

  // Featured = available cars that actually have an AutoHome 360° pano. Public,
  // RLS-scoped, explicit column list (never select("*")). spec_data is scrubbed
  // of internal fields below — pano_id survives (it's a public display field).
  const { data } = await supabase
    .from("cars")
    .select(PUBLIC_CAR_COLUMNS)
    .eq("is_available", true)
    .not("spec_data->>pano_id", "is", null)
    .order("order_position", { ascending: true })
    .limit(8);

  const scrubbed = scrubCarsForPublic((data || []) as unknown as Car[]);
  const cars: ShowroomCar[] = scrubbed
    .filter((c) => c.spec_data?.pano_id)
    .map((c) => ({
      slug: c.slug,
      brand: c.brand,
      model: c.model,
      year: c.year,
      priceUsd: c.price_usd ?? 0,
      poster: Array.isArray(c.images) ? (c.images[0] as string | undefined) : undefined,
      panoId: c.spec_data!.pano_id as string,
    }));

  return <ShowroomContent cars={cars} />;
}
