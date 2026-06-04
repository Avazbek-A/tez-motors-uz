import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildMetaCsv, FEED_CAR_COLUMNS, type FeedCar } from "@/lib/feeds";

/**
 * Public Meta (Facebook/Instagram) catalog CSV of available cars. The dealer
 * adds this URL as a scheduled data-feed in Meta Commerce Manager to power
 * Facebook/Instagram shops + dynamic ads. Anon RLS-gated read, cached, fail-soft.
 */
export const revalidate = 600;

export async function GET() {
  let cars: FeedCar[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("cars")
      .select(FEED_CAR_COLUMNS)
      .neq("inventory_status", "sold")
      .order("created_at", { ascending: false })
      .limit(1000);
    cars = (data as unknown as FeedCar[]) || [];
  } catch {
    cars = [];
  }
  return new NextResponse(buildMetaCsv(cars), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "cache-control": "public, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
