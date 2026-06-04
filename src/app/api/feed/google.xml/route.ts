import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildGoogleFeed, FEED_CAR_COLUMNS, type FeedCar } from "@/lib/feeds";

/**
 * Public Google Merchant / RSS product feed of available cars. The dealer points
 * Google Merchant Center at this URL; it refreshes on Google's schedule. Anon
 * (RLS-gated) read, cached. Fail-soft: an error returns an empty-but-valid feed
 * so a transient blip never suspends the merchant account.
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
  return new NextResponse(buildGoogleFeed(cars), {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
