import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Demand intelligence — the "what should I import next" brain.
 *
 * Aggregates the demand signals the site already captures into a ranked board:
 *   - favorites, price-watches, and car-linked inquiries → which CURRENT cars
 *     are hot (source more like these);
 *   - saved-search filters → which brands buyers WANT that may not be in stock.
 *
 * Read-only, service-role, admin-gated. Intent-weighted score:
 *   inquiry ×5  (real lead)  >  watch ×3  (price intent)  >  favorite ×1.
 */
const W_INQUIRY = 5;
const W_WATCH = 3;
const W_FAVORITE = 1;
const MAX_ROWS = 5000;

function inc(map: Map<string, number>, key: string | null | undefined, by = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + by);
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();

    const [favRes, watchRes, inqRes, savedRes] = await Promise.all([
      supabase.from("favorites").select("car_id").limit(MAX_ROWS),
      supabase.from("price_watches").select("car_id, target_price_usd").is("notified_at", null).limit(MAX_ROWS),
      supabase.from("inquiries").select("car_id").not("car_id", "is", null).limit(MAX_ROWS),
      supabase.from("saved_searches").select("filters").limit(MAX_ROWS),
    ]);

    const favByCar = new Map<string, number>();
    for (const r of favRes.data || []) inc(favByCar, r.car_id as string);

    const watchByCar = new Map<string, number>();
    const watchMinTarget = new Map<string, number>();
    for (const r of watchRes.data || []) {
      const id = r.car_id as string;
      inc(watchByCar, id);
      const t = typeof r.target_price_usd === "number" ? r.target_price_usd : Number(r.target_price_usd);
      if (Number.isFinite(t)) {
        watchMinTarget.set(id, Math.min(watchMinTarget.get(id) ?? Infinity, t));
      }
    }

    const inqByCar = new Map<string, number>();
    for (const r of inqRes.data || []) inc(inqByCar, r.car_id as string);

    // Union of all car ids that have any signal.
    const carIds = new Set<string>([...favByCar.keys(), ...watchByCar.keys(), ...inqByCar.keys()]);

    const carById = new Map<string, { brand: string; model: string; year: number | null; price_usd: number | null; inventory_status: string | null; slug: string | null }>();
    if (carIds.size > 0) {
      const { data: cars } = await supabase
        .from("cars")
        .select("id, brand, model, year, price_usd, inventory_status, slug")
        .in("id", Array.from(carIds));
      for (const c of cars || []) carById.set(c.id as string, c as never);
    }

    const hotCars = Array.from(carIds)
      .map((id) => {
        const car = carById.get(id);
        const favorites = favByCar.get(id) || 0;
        const watches = watchByCar.get(id) || 0;
        const inquiries = inqByCar.get(id) || 0;
        const score = inquiries * W_INQUIRY + watches * W_WATCH + favorites * W_FAVORITE;
        const minTarget = watchMinTarget.get(id);
        return {
          car_id: id,
          brand: car?.brand ?? null,
          model: car?.model ?? null,
          year: car?.year ?? null,
          price_usd: car?.price_usd ?? null,
          inventory_status: car?.inventory_status ?? null,
          slug: car?.slug ?? null,
          favorites,
          watches,
          inquiries,
          minTarget: minTarget != null && Number.isFinite(minTarget) ? minTarget : null,
          score,
        };
      })
      .filter((c) => c.brand) // drop orphaned signals (car deleted)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);

    // Demand by brand (rolls hot-car scores up to a sourcing-level view).
    const brandScore = new Map<string, number>();
    const brandCars = new Map<string, number>();
    for (const c of hotCars) {
      if (!c.brand) continue;
      brandScore.set(c.brand, (brandScore.get(c.brand) || 0) + c.score);
      brandCars.set(c.brand, (brandCars.get(c.brand) || 0) + 1);
    }
    const byBrand = Array.from(brandScore.entries())
      .map(([brand, score]) => ({ brand, score, cars: brandCars.get(brand) || 0 }))
      .sort((a, b) => b.score - a.score);

    // Wanted brands from saved-search filters (demand not tied to a stocked car).
    const wantedBrand = new Map<string, number>();
    for (const r of savedRes.data || []) {
      const f = (r.filters || {}) as Record<string, unknown>;
      const brand = typeof f.brand === "string" ? f.brand : null;
      if (brand) inc(wantedBrand, brand);
    }
    const wantedBrands = Array.from(wantedBrand.entries())
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return NextResponse.json({
      ok: true,
      totals: {
        favorites: favByCar.size ? Array.from(favByCar.values()).reduce((a, b) => a + b, 0) : 0,
        watches: Array.from(watchByCar.values()).reduce((a, b) => a + b, 0),
        inquiries: Array.from(inqByCar.values()).reduce((a, b) => a + b, 0),
        savedSearches: (savedRes.data || []).length,
      },
      hotCars,
      byBrand,
      wantedBrands,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to compute demand" }, { status: 500 });
  }
}
