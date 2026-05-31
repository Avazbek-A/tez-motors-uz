import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyPriceWatchers } from "@/lib/price-watch";
import { reportServerError } from "@/lib/error-report";

/**
 * Safety-net re-scan of price_watches. The primary path emails watchers inline
 * when the admin lowers a price (src/app/api/admin/cars/[id]/route.ts). This
 * sweep catches anything that path missed — a transient Resend outage, a price
 * imported via CSV that bypassed the admin route, etc.
 *
 * Per-run cap (MAX_CARS) bounds blast radius: a careless bulk price edit can't
 * storm every watcher in one tick; the next sweep picks up the remainder.
 */
const MAX_CARS = 50;

async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const supabase = createServiceClient();

    // Distinct cars that still have at least one pending watch.
    const { data: pending, error: pendingErr } = await supabase
      .from("price_watches")
      .select("car_id")
      .is("notified_at", null)
      .not("car_id", "is", null)
      .limit(2000);

    if (pendingErr) {
      return NextResponse.json({ ok: false, error: "query failed" }, { status: 500 });
    }

    const carIds = Array.from(new Set((pending || []).map((p) => p.car_id as string))).slice(0, MAX_CARS);
    if (carIds.length === 0) {
      return NextResponse.json({ ok: true, cars: 0, sent: 0 });
    }

    // Only consider cars that are still on the market.
    const { data: cars, error: carsErr } = await supabase
      .from("cars")
      .select("id, slug, brand, model, year, price_usd, inventory_status")
      .in("id", carIds)
      .neq("inventory_status", "sold");

    if (carsErr) {
      return NextResponse.json({ ok: false, error: "cars query failed" }, { status: 500 });
    }

    let sent = 0;
    for (const car of cars || []) {
      if (typeof car.price_usd !== "number") continue;
      sent += await notifyPriceWatchers(supabase, {
        id: car.id as string,
        slug: car.slug as string,
        brand: car.brand as string,
        model: car.model as string,
        year: (car.year as number | null) ?? null,
        price_usd: car.price_usd as number,
      });
    }

    console.error(
      "cron.pricewatchsweep.ok",
      JSON.stringify({ event: "cron.price_watch_sweep", cars: (cars || []).length, sent }),
    );
    return NextResponse.json({ ok: true, cars: (cars || []).length, sent });
  } catch (error) {
    reportServerError("GET /api/cron/price-watch-sweep", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
