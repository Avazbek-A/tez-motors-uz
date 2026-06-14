import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Lead-to-inventory matching (pricing-engine Phase 6). Connects open buyer demand
 * (saved searches) to what we can actually sell: matched = a saved search whose
 * criteria a car in stock satisfies (call that lead now); unmatched = demand for
 * something we don't stock (an import signal). Read-only, admin.
 */
const MAX = 5000;

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();
    const [searchRes, carsRes] = await Promise.all([
      supabase.from("saved_searches").select("filters").limit(MAX),
      supabase
        .from("cars")
        .select("id, slug, brand, model, year, price_usd, in_stock, inventory_status")
        .or("in_stock.eq.true,inventory_status.eq.available")
        .limit(MAX),
    ]);

    const cars = (carsRes.data || []).map((c) => ({
      id: c.id as string,
      slug: c.slug as string,
      brand: ((c.brand as string) || "").toLowerCase(),
      model: ((c.model as string) || "").toLowerCase(),
      brandRaw: c.brand as string,
      modelRaw: c.model as string,
      year: (c.year as number) ?? null,
      price: Number(c.price_usd) || 0,
    }));

    const num = (v: unknown) => (v == null ? null : Number(v) || null);
    const matched: { filter: Record<string, unknown>; cars: { id: string; slug: string; label: string; price: number }[] }[] = [];
    const unmatched: Record<string, unknown>[] = [];

    for (const s of searchRes.data || []) {
      const f = (s.filters || {}) as { brand?: string; model?: string; price_min?: number; price_max?: number; priceMin?: number; priceMax?: number };
      const brand = f.brand?.toLowerCase();
      const model = f.model?.toLowerCase();
      const min = num(f.price_min ?? f.priceMin);
      const max = num(f.price_max ?? f.priceMax);
      const hits = cars.filter(
        (c) =>
          (!brand || c.brand === brand) &&
          (!model || c.model.includes(model)) &&
          (min == null || c.price >= min) &&
          (max == null || c.price <= max),
      );
      if (hits.length) {
        matched.push({ filter: f, cars: hits.slice(0, 8).map((c) => ({ id: c.id, slug: c.slug, label: `${c.brandRaw} ${c.modelRaw}${c.year ? " " + c.year : ""}`, price: c.price })) });
      } else if (brand || model) {
        unmatched.push(f); // demand we can't fill from stock → import opportunity
      }
    }

    return NextResponse.json({
      ok: true,
      savedSearches: (searchRes.data || []).length,
      stockCars: cars.length,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      matched: matched.slice(0, 50),
      unmatched: unmatched.slice(0, 50),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to match leads" }, { status: 500 });
  }
}
