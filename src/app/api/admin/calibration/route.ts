import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { median, cleanCarPrices } from "@/lib/market-intel";
import { baseModelKey } from "@/lib/model-normalize";

/**
 * Calibration loop (pricing-engine Phase 6) — the ground-truth check that turns the
 * engine from a guess into something tuned to reality. It compares the price of
 * cars we actually SOLD against the market median for that model, to surface a
 * systematic bias (are we listing above/below market on the cars that move?).
 *
 * SCAFFOLD: this uses each sold car's last listed price as a proxy for the realized
 * sale price. True calibration needs recorded *transaction* prices + the prediction
 * made at the time — wire those in and this becomes a real error-vs-prediction loop.
 * Until then it reports a directional bias + clearly flags the proxy. Read-only.
 */
const MAX = 5000;
const WINDOW_DAYS = 120;

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
    const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

    const [soldRes, marketRes] = await Promise.all([
      supabase.from("cars").select("brand, model, price_usd, updated_at").eq("inventory_status", "sold").limit(MAX),
      supabase.from("market_listings").select("brand, model, price_usd").gte("observed_at", since).not("price_usd", "is", null).limit(MAX),
    ]);

    // Market median per base-model key.
    const byKey = new Map<string, number[]>();
    for (const m of marketRes.data || []) {
      const k = baseModelKey(m.brand as string, m.model as string);
      (byKey.get(k) || byKey.set(k, []).get(k)!).push(num(m.price_usd));
    }
    const medianByKey = new Map<string, number>();
    for (const [k, arr] of byKey) {
      const med = median(cleanCarPrices(arr));
      if (med != null) medianByKey.set(k, med);
    }

    const errors: number[] = [];
    let matched = 0;
    for (const c of soldRes.data || []) {
      const price = num(c.price_usd);
      if (!(price > 0)) continue;
      const med = medianByKey.get(baseModelKey(c.brand as string, c.model as string));
      if (med == null || med <= 0) continue;
      matched += 1;
      errors.push(((price - med) / med) * 100); // + = we listed above market
    }

    const soldTotal = (soldRes.data || []).length;
    if (matched === 0) {
      return NextResponse.json({
        ok: true,
        calibrated: false,
        reason: "no sold cars match a model with market comps yet",
        soldTotal,
        proxy: true,
      });
    }

    const sorted = [...errors].sort((a, b) => a - b);
    const biasPct = sorted[Math.floor(sorted.length / 2)];
    const mean = errors.reduce((a, b) => a + b, 0) / errors.length;
    const mae = errors.reduce((a, b) => a + Math.abs(b), 0) / errors.length;

    return NextResponse.json({
      ok: true,
      calibrated: true,
      proxy: true, // last-listed price, not realized sale price — see file header
      soldTotal,
      matched,
      medianBiasPct: Math.round(biasPct * 10) / 10, // + = sold cars listed above market median
      meanBiasPct: Math.round(mean * 10) / 10,
      meanAbsErrorPct: Math.round(mae * 10) / 10,
      note:
        biasPct > 5
          ? "sold cars were listed above market — pricing may be leaving cars slow or selling on other factors"
          : biasPct < -5
            ? "sold cars were listed below market — possible money left on the table"
            : "sold prices track the market median closely",
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to compute calibration" }, { status: 500 });
  }
}
