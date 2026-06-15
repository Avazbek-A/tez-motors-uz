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
      .select("brand, body_type, fuel_type")
      .neq("inventory_status", "sold");
    const rows = (data || []) as Array<{ brand: string | null; body_type: string | null; fuel_type: string | null }>;
    const uniq = (f: "brand" | "body_type" | "fuel_type") =>
      [...new Set(rows.map((r) => r[f]).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
    return NextResponse.json(
      { brands: uniq("brand"), body_types: uniq("body_type"), fuel_types: uniq("fuel_type") },
      { headers: cacheHeaders },
    );
  } catch {
    return NextResponse.json({ brands: [], body_types: [], fuel_types: [] });
  }
}
