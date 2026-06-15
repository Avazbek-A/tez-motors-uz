import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Filter facets for the catalog — the DISTINCT brand / body_type / fuel_type
 * values that actually exist in live (non-sold) inventory. The catalog renders
 * its filters from this instead of a hardcoded list, so every in-stock brand
 * appears and dead options (a body/fuel type with no cars) never show. Brand
 * spellings are normalized at the data layer (see migration/cleanup), so a plain
 * distinct is already deduped. Small payload, cached at the edge.
 */
const cacheHeaders = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" };

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("cars")
      .select("brand, body_type, fuel_type, transmission, drivetrain, seats, year")
      .neq("inventory_status", "sold");
    type Row = { brand: string | null; body_type: string | null; fuel_type: string | null; transmission: string | null; drivetrain: string | null; seats: number | null; year: number | null };
    const rows = (data || []) as Row[];
    const uniqStr = (f: "brand" | "body_type" | "fuel_type" | "transmission" | "drivetrain") =>
      [...new Set(rows.map((r) => r[f]).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
    const seats = [...new Set(rows.map((r) => r.seats).filter((v): v is number => typeof v === "number"))].sort((a, b) => a - b);
    const years = rows.map((r) => r.year).filter((v): v is number => typeof v === "number");
    return NextResponse.json(
      {
        brands: uniqStr("brand"),
        body_types: uniqStr("body_type"),
        fuel_types: uniqStr("fuel_type"),
        transmissions: uniqStr("transmission"),
        drivetrains: uniqStr("drivetrain"),
        seats,
        year_min: years.length ? Math.min(...years) : null,
        year_max: years.length ? Math.max(...years) : null,
      },
      { headers: cacheHeaders },
    );
  } catch {
    return NextResponse.json({ brands: [], body_types: [], fuel_types: [], transmissions: [], drivetrains: [], seats: [], year_min: null, year_max: null });
  }
}
