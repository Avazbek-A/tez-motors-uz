import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { googleIndexCoverage } from "@/lib/seo/webmaster";

/**
 * Google index coverage — inspects each available car page via the Search Console
 * URL Inspection API and reports which are actually indexed vs not (so unfound
 * listings surface). On-demand (POST + a button) rather than on-page-load, because
 * it's N API calls and has a daily quota. Admin only.
 */
const MAX_CARS = 120; // URL Inspection quota is 2000/day — cap per run.

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  try {
    const supabase = createServiceClient();
    const { data: cars } = await supabase
      .from("cars")
      .select("slug, brand, model, year")
      .eq("inventory_status", "available")
      .limit(MAX_CARS);
    const items = (cars || [])
      .filter((c) => c.slug)
      .map((c) => ({
        url: `https://tezmotors.uz/ru/catalog/${c.slug}`,
        path: `/ru/catalog/${c.slug}`,
        label: `${c.brand} ${c.model}${c.year ? " " + c.year : ""}`,
      }));
    const coverage = await googleIndexCoverage(items);
    return NextResponse.json({ ok: true, ...coverage });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to check index coverage" }, { status: 500 });
  }
}
