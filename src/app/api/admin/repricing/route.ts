import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { median, cleanCarPrices, mileageAdjustedValue, priceTrend } from "@/lib/market-intel";
import { holdingCost, valueAdjustmentFactor, warrantyMonthsLeft } from "@/lib/market-analytics";
import { baseModelKey } from "@/lib/model-normalize";

/**
 * Dynamic repricing — points the engine at YOUR OWN stock. For each sellable car
 * it computes the market fair value (mileage-adjusted), the days it's been sitting,
 * the cost of capital accrued, and a suggested markdown when the unit is overpriced
 * vs the market and/or aging. Frees trapped capital — often a bigger lever than the
 * buy side. Read-only, admin, $0.
 */
const MAX = 5000;
const WINDOW_DAYS = 120;
const MIN_COMPS = 3;
const GRACE_DAYS = 45; // no age-markdown before this
const AGE_STEP_DAYS = 30;
const AGE_STEP_PCT = 0.02; // 2% per extra 30d sitting
const FLOOR_FACTOR = 0.7; // never suggest below 70% of current (sanity)
const MIN_MARKDOWN_PCT = 2;

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
    const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

    const [carsRes, marketRes] = await Promise.all([
      supabase
        .from("cars")
        .select("id, slug, brand, model, year, price_usd, mileage, inventory_status, in_stock, created_at, in_service_date, battery_soh_pct, import_channel")
        .or("in_stock.eq.true,inventory_status.eq.available")
        .limit(MAX),
      supabase
        .from("market_listings")
        .select("brand, model, price_usd, mileage_km, observed_at, last_seen_at")
        .gte("observed_at", since)
        .not("price_usd", "is", null)
        .limit(MAX),
    ]);

    // Comps by base-model key → price+mileage pairs + lifecycle for trend.
    type Comp = { price_usd: number; mileage_km: number | null; observed_at: string | null; last_seen_at: string | null };
    const compsByKey = new Map<string, Comp[]>();
    for (const m of marketRes.data || []) {
      const k = baseModelKey(m.brand as string, m.model as string);
      (compsByKey.get(k) || compsByKey.set(k, []).get(k)!).push({
        price_usd: num(m.price_usd),
        mileage_km: m.mileage_km == null ? null : num(m.mileage_km),
        observed_at: (m.observed_at as string) ?? null,
        last_seen_at: (m.last_seen_at as string) ?? null,
      });
    }

    const now = Date.now();
    const items = [];
    for (const c of carsRes.data || []) {
      const currentPrice = num(c.price_usd);
      if (!(currentPrice > 0)) continue;
      const comps = compsByKey.get(baseModelKey(c.brand as string, c.model as string)) || [];
      if (comps.length < MIN_COMPS) continue;

      const mileage = num(c.mileage);
      const baseFair =
        mileage > 1000 ? mileageAdjustedValue(comps, mileage).value : median(cleanCarPrices(comps.map((x) => x.price_usd)));
      if (baseFair == null || baseFair <= 0) continue;
      // Adjust the market fair for attributes the median can't see: battery health,
      // warranty remaining, official-vs-gray provenance (Phase 5 value inputs).
      const adj = valueAdjustmentFactor({
        batterySohPct: c.battery_soh_pct == null ? null : num(c.battery_soh_pct),
        warrantyMonthsLeft: warrantyMonthsLeft(c.in_service_date as string | null),
        importChannel: (c.import_channel as string) ?? null,
      });
      const fair = Math.round(baseFair * adj);

      const createdMs = Date.parse((c.created_at as string) || "") || now;
      const daysInStock = Math.max(0, Math.floor((now - createdMs) / 86_400_000));
      const trendPct = priceTrend(comps, { windowDays: 30 }).changePct;

      // Only ever mark DOWN. Target = the market fair when overpriced, else hold.
      const overpriced = currentPrice > fair;
      const target = overpriced ? fair : currentPrice;
      const ageSteps = Math.max(0, Math.floor((daysInStock - GRACE_DAYS) / AGE_STEP_DAYS));
      const ageFactor = 1 - ageSteps * AGE_STEP_PCT;
      // A falling market nudges one extra step.
      const trendFactor = trendPct != null && trendPct < -5 ? 1 - AGE_STEP_PCT : 1;
      let suggested = Math.round(Math.min(currentPrice, target) * ageFactor * trendFactor);
      suggested = Math.max(suggested, Math.round(currentPrice * FLOOR_FACTOR));

      const markdownUsd = currentPrice - suggested;
      const markdownPct = Math.round((markdownUsd / currentPrice) * 1000) / 10;
      if (markdownPct < MIN_MARKDOWN_PCT) continue; // priced fine — leave it

      const reasons: string[] = [];
      if (overpriced) reasons.push("above market");
      if (ageSteps > 0) reasons.push(`${daysInStock}d in stock`);
      if (trendPct != null && trendPct < -5) reasons.push(`market −${Math.abs(trendPct)}%`);

      items.push({
        id: c.id,
        slug: c.slug,
        brand: c.brand,
        model: c.model,
        year: c.year,
        currentPriceUsd: currentPrice,
        marketFairUsd: fair,
        suggestedPriceUsd: suggested,
        markdownUsd,
        markdownPct,
        daysInStock,
        holdingCostUsd: holdingCost(currentPrice, daysInStock),
        negotiationFloorUsd: Math.round(fair * 0.9), // lowest to accept before walking
        marketTrendPct: trendPct,
        reason: reasons.join(" · ") || "market-aligned cut",
        urgency: daysInStock > 90 || markdownPct >= 8 ? "high" : daysInStock > 60 || markdownPct >= 4 ? "medium" : "low",
      });
    }

    items.sort((a, b) => b.markdownUsd - a.markdownUsd);
    const totalTrapped = items.reduce((a, i) => a + i.holdingCostUsd, 0);
    return NextResponse.json({ ok: true, count: items.length, totalHoldingCostUsd: totalTrapped, items });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to compute repricing" }, { status: 500 });
  }
}
