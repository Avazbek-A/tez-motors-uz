import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import { median } from "@/lib/market-intel";
import { estimateTradeIn } from "@/lib/tradein-estimate";

/**
 * Instant trade-in estimate (Phase AL). Anchors on the resale-market median for
 * the customer's brand/model (from market_listings) and depreciates for age /
 * mileage / condition minus a dealer buffer (src/lib/tradein-estimate.ts).
 * Returns a RANGE, clearly an estimate — the dealer confirms after inspection.
 * Rate-limited; reads only (no PII stored here).
 */
const checkRateLimit = createKvRateLimiter({ max: 20, windowMs: 10 * 60 * 1000, prefix: "tradein-estimate" });

const schema = z.object({
  brand: z.string().min(1).max(64),
  model: z.string().min(1).max(128),
  year: z.number().int().min(1980).max(2100).optional().nullable(),
  mileage_km: z.number().int().min(0).max(2_000_000).optional().nullable(),
  condition: z.enum(["excellent", "good", "fair", "poor"]).optional().nullable(),
  now_year: z.number().int().min(2024).max(2100).optional(), // client clock; clamped
});

export async function POST(request: NextRequest) {
  try {
    if (!(await checkRateLimit(getClientIp(request)))) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }
    const data = schema.parse(await request.json());

    const supabase = createServiceClient();

    // Market anchor: median resale price (already normalized to USD on ingest)
    // for the model over recent listings.
    const since = new Date(Date.now() - 180 * 86_400_000).toISOString();
    const { data: rows } = await supabase
      .from("market_listings")
      .select("price_usd, observed_at")
      .ilike("brand", data.brand)
      .ilike("model", `%${data.model}%`)
      .gte("observed_at", since)
      .not("price_usd", "is", null)
      .limit(500);

    const prices: number[] = [];
    for (const r of rows || []) {
      const usd = typeof r.price_usd === "number" ? r.price_usd : Number(r.price_usd);
      if (Number.isFinite(usd) && usd > 0) prices.push(usd);
    }
    const marketMedianUsd = median(prices);

    // Clamp the client-provided year to a sane current-year window.
    const nowYear = Math.min(2100, Math.max(2024, data.now_year ?? 2026));

    const estimate = estimateTradeIn({
      marketMedianUsd,
      year: data.year ?? null,
      mileageKm: data.mileage_km ?? null,
      condition: data.condition ?? null,
      nowYear,
    });

    if (!estimate) {
      return NextResponse.json({ ok: true, estimate: null, reason: "no_market_data" });
    }
    return NextResponse.json({ ok: true, estimate, sample: prices.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
