import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { categorizeCar } from "@/lib/car-category";
import type { Car } from "@/types/car";

/**
 * Backfill the materialized categorization columns (seats, range_km, drivetrain)
 * from categorizeCar() over the live spec_data, so the catalog can FILTER on them.
 * Idempotent — only writes rows whose computed value changed. Run after deploys /
 * after the AutoHome colors collector refreshes spec_data. Admin only.
 */
export async function POST(request: NextRequest) {
  // Admin session OR an authorized cron call (lets it run on a schedule after the
  // colors collector refreshes spec_data, and be triggered server-side).
  const adminGuard = await requireAdmin(request);
  if (adminGuard) {
    const cronGuard = assertCron(request);
    if (cronGuard) return cronGuard;
  }
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from("cars").select("*").limit(1000);
    const cars = (data || []) as (Car & { seats?: number | null; range_km?: number | null })[];
    let updated = 0;
    for (const c of cars) {
      const cat = categorizeCar(c);
      const patch: Record<string, unknown> = {};
      if (cat.seats != null && cat.seats !== c.seats) patch.seats = cat.seats;
      if (cat.rangeKm != null && cat.rangeKm !== c.range_km) patch.range_km = cat.rangeKm;
      if (cat.driveType && cat.driveType !== c.drivetrain) patch.drivetrain = cat.driveType;
      if (Object.keys(patch).length === 0) continue;
      const { error } = await supabase.from("cars").update(patch).eq("id", c.id);
      if (!error) updated++;
    }
    return NextResponse.json({ ok: true, total: cars.length, updated });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 200) }, { status: 500 });
  }
}
