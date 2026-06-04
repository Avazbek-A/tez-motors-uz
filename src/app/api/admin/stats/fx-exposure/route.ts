import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getFxRates, getCnyPerUsdHistory } from "@/lib/fx-rate";
import { computeFxExposure, hedgeSignal, type OpenCnyPo } from "@/lib/fx-exposure";

/**
 * CNY/USD exposure on open purchase orders (Phase AK). Quantifies how much the
 * dealer's open CNY payables have moved since each PO was ordered, and emits an
 * advisory lock-vs-wait hint from the recent rate trend. Read-only, admin-gated.
 * ADVISORY only — never auto-acts.
 */
const OPEN_PO_STATUSES = ["draft", "ordered", "in_production", "shipped"];

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();
    const fx = await getFxRates(supabase);
    const cnyPerUsdNow = fx.cny_uzs > 0 ? fx.usd_uzs / fx.cny_uzs : 0;

    const { data: pos } = await supabase
      .from("purchase_orders")
      .select("quote_currency, quote_amount, fx_cny_per_usd_at_order, unit_cost_usd, qty, status")
      .in("status", OPEN_PO_STATUSES)
      .limit(5000);

    // Only CNY-quoted POs carry FX exposure. Fall back to unit_cost_usd × qty
    // converted at the order rate when an explicit CNY quote_amount is absent.
    const openCny: OpenCnyPo[] = [];
    for (const p of pos || []) {
      if (p.quote_currency !== "CNY") continue;
      const orderRate = (p.fx_cny_per_usd_at_order as number) || cnyPerUsdNow;
      const amountCny =
        p.quote_amount != null
          ? Number(p.quote_amount)
          : (Number(p.unit_cost_usd) || 0) * (Number(p.qty) || 1) * orderRate;
      if (amountCny > 0) openCny.push({ amountCny, cnyPerUsdAtOrder: orderRate });
    }

    const exposure = computeFxExposure(openCny, cnyPerUsdNow);
    const history = await getCnyPerUsdHistory(supabase);
    const signal = hedgeSignal(history.length >= 2 ? history : [cnyPerUsdNow]);

    return NextResponse.json({
      ok: true,
      cny_per_usd_now: Math.round(cnyPerUsdNow * 1000) / 1000,
      open_cny_pos: openCny.length,
      exposure,
      hedge_signal: signal,
      history_points: history.length,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to compute FX exposure" }, { status: 500 });
  }
}
