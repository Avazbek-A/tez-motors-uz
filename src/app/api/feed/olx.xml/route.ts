import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildOlxFeed, FEED_CAR_COLUMNS, type FeedCar } from "@/lib/feeds";

/**
 * Public OLX.uz autoload XML feed of available cars. An OLX business account can
 * point its autoload import at this URL to publish inventory automatically — the
 * real automation path for OLX (no open per-seller publish API). Anon RLS-gated
 * read, cached, fail-soft.
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
  return new NextResponse(buildOlxFeed(cars), {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
