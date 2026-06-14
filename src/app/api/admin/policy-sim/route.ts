import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import {
  computeLandedCost,
  resolveFuelKind,
  DEFAULT_IMPORT_CONFIG,
  FUEL_KINDS,
  type ImportConfig,
  type FuelKind,
} from "@/lib/import-cost";

/**
 * Import-policy scenario simulator (pricing-engine Phase 6). UZ customs/duty rules
 * shift often; this answers "if customs duty changes by ±N points, what happens to
 * my landed costs and margins across the catalog?" — turning policy risk into a
 * planning tool. ?dutyDelta=N (percentage points on customsDutyPct), ?fuel=...
 * Read-only, admin.
 */
const MAX = 5000;

function loadConfig(stored: unknown): ImportConfig {
  const s = (stored && typeof stored === "object" ? stored : {}) as Partial<ImportConfig>;
  const rates = { ...DEFAULT_IMPORT_CONFIG.rates };
  for (const f of FUEL_KINDS) rates[f] = { ...DEFAULT_IMPORT_CONFIG.rates[f], ...(s.rates?.[f] ?? {}) };
  return { rates, fees: { ...DEFAULT_IMPORT_CONFIG.fees, ...(s.fees ?? {}) }, targetMarginPct: s.targetMarginPct ?? DEFAULT_IMPORT_CONFIG.targetMarginPct };
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();
    const params = new URL(request.url).searchParams;
    const dutyDelta = Math.max(-50, Math.min(50, Number(params.get("dutyDelta")) || 10));
    const fuelFilter = params.get("fuel");

    const [carsRes, cfgRes] = await Promise.all([
      supabase.from("cars").select("fuel_type, price_usd, original_price_usd").limit(MAX),
      supabase.from("site_settings").select("values").eq("id", "import_config").maybeSingle(),
    ]);
    const config = loadConfig(cfgRes.data?.values);

    const landedFor = (cif: number, fuel: FuelKind, deltaPct: number) =>
      computeLandedCost({
        vehiclePriceUsd: cif,
        freightUsd: config.fees.freightUsd,
        clearanceUsd: config.fees.clearanceUsd,
        inlandLogisticsUsd: config.fees.inlandLogisticsUsd,
        otherUsd: config.fees.otherUsd,
        rates: { ...config.rates[fuel], customsDutyPct: Math.max(0, config.rates[fuel].customsDutyPct + deltaPct) },
      }).landedCostUsd;

    // Per-fuel scenario on a representative $20k CIF.
    const perFuel = FUEL_KINDS.map((f) => {
      const now = landedFor(20000, f, 0);
      const next = landedFor(20000, f, dutyDelta);
      return { fuel: f, dutyNowPct: config.rates[f].customsDutyPct, landedNowUsd: now, landedNewUsd: next, deltaUsd: next - now };
    });

    // Catalog impact: CIF proxy = original price, else 70% of list. Margin = list − landed.
    let extraSum = 0;
    let marginDeltaSum = 0;
    let flipped = 0;
    let counted = 0;
    for (const c of carsRes.data || []) {
      const fuel = resolveFuelKind(c.fuel_type as string);
      if (fuelFilter && fuel !== fuelFilter) continue;
      const price = Number(c.price_usd) || 0;
      const cif = Number(c.original_price_usd) || Math.round(price * 0.7);
      if (cif <= 0 || price <= 0) continue;
      counted += 1;
      const landedNow = landedFor(cif, fuel, 0);
      const landedNew = landedFor(cif, fuel, dutyDelta);
      extraSum += landedNew - landedNow;
      const marginNow = price - landedNow;
      const marginNew = price - landedNew;
      marginDeltaSum += marginNew - marginNow;
      if (marginNow > 0 && marginNew <= 0) flipped += 1;
    }

    return NextResponse.json({
      ok: true,
      dutyDeltaPct: dutyDelta,
      perFuel,
      catalog: {
        carsCounted: counted,
        avgExtraLandedUsd: counted ? Math.round(extraSum / counted) : 0,
        totalMarginImpactUsd: Math.round(marginDeltaSum),
        carsFlippedUnprofitable: flipped,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to run policy simulation" }, { status: 500 });
  }
}
