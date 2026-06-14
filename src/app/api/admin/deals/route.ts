import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { median, cleanCarPrices, mileageAdjustedValue } from "@/lib/market-intel";
import { motivationScore, classifySeller, extractPhone } from "@/lib/market-analytics";
import { baseModelKey } from "@/lib/model-normalize";

/**
 * Deal-sniper — the buy-low feed. Scans LIVE individual market listings and flags
 * the ones priced materially below their model's mileage-adjusted fair value:
 * acquisition targets the dealer could buy and resell. Weighted by seller
 * motivation and private-vs-dealer (a motivated private seller underpricing is the
 * best target). Read-only, admin. $0 — pure heuristics over collected listings.
 */
const MAX = 5000;
const WINDOW_DAYS = 120; // comps window
const LIVE_DAYS = 14; // a listing seen within this is still buyable
const MIN_DISCOUNT = 0.1; // ≥10% under fair to qualify
const MAX_DISCOUNT = 0.6; // >60% under = almost certainly junk/scam/typo, not a deal
const MIN_COMPS = 4;

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
    const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

    const { data: rows } = await supabase
      .from("market_listings")
      .select("id, brand, model, year, mileage_km, price_usd, city, source, source_ref, raw_text, observed_at, last_seen_at")
      .gte("observed_at", since)
      .not("price_usd", "is", null)
      .limit(MAX);

    const listings = (rows || []).map((m) => ({
      id: m.id as string,
      brand: (m.brand as string) || "",
      model: (m.model as string) || "",
      year: (m.year as number) ?? null,
      mileage_km: m.mileage_km == null ? null : num(m.mileage_km),
      price_usd: num(m.price_usd),
      city: (m.city as string) ?? null,
      source: (m.source as string) ?? "other",
      source_ref: (m.source_ref as string) ?? null,
      raw_text: (m.raw_text as string) ?? null,
      observed_at: (m.observed_at as string) ?? null,
      last_seen_at: (m.last_seen_at as string) ?? null,
    }));

    // Phone volume → dealer detection.
    const phoneCounts = new Map<string, number>();
    for (const l of listings) {
      const p = extractPhone(l.raw_text);
      if (p) phoneCounts.set(p, (phoneCounts.get(p) || 0) + 1);
    }

    // Comps by base-model key (so trims pool) → price+mileage pairs.
    const compsByKey = new Map<string, { price_usd: number; mileage_km: number | null }[]>();
    for (const l of listings) {
      const k = baseModelKey(l.brand, l.model);
      (compsByKey.get(k) || compsByKey.set(k, []).get(k)!).push({ price_usd: l.price_usd, mileage_km: l.mileage_km });
    }

    const now = Date.now();
    const deals = [];
    for (const l of listings) {
      // Live only — a sold/withdrawn listing isn't a buyable target.
      const last = Date.parse(l.last_seen_at || l.observed_at || "");
      if (!last || now - last > LIVE_DAYS * 86_400_000) continue;
      if (!(l.price_usd > 0)) continue;

      const comps = compsByKey.get(baseModelKey(l.brand, l.model)) || [];
      if (comps.length < MIN_COMPS) continue;

      // Fair value at this car's mileage (hedonic), else the model median.
      const fair =
        l.mileage_km != null
          ? mileageAdjustedValue(comps, l.mileage_km).value
          : median(cleanCarPrices(comps.map((c) => c.price_usd)));
      if (fair == null || fair <= 0) continue;

      const discount = (fair - l.price_usd) / fair;
      if (discount < MIN_DISCOUNT || discount > MAX_DISCOUNT) continue;

      const phone = extractPhone(l.raw_text);
      const seller = classifySeller(l.raw_text, { phoneListingCount: phone ? phoneCounts.get(phone) : 0 });
      const motivation = motivationScore(l.raw_text);
      const ageDays = Math.floor((now - last) / 86_400_000);

      // Discount is the core; amplify by motivation and prefer private sellers.
      const score = Math.round(discount * 100 * (0.6 + 0.4 * motivation) * (seller === "private" ? 1.15 : 0.9));

      deals.push({
        brand: l.brand,
        model: l.model,
        year: l.year,
        priceUsd: l.price_usd,
        fairUsd: fair,
        discountPct: Math.round(discount * 1000) / 10,
        underUsd: Math.round(fair - l.price_usd),
        mileageKm: l.mileage_km,
        city: l.city,
        seller,
        motivation,
        source: l.source,
        sourceRef: l.source_ref,
        ageDays,
        score,
      });
    }

    deals.sort((a, b) => b.score - a.score);
    return NextResponse.json({ ok: true, count: deals.length, deals: deals.slice(0, 60) });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to compute deals" }, { status: 500 });
  }
}
