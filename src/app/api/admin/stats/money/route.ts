import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { getFxRates } from "@/lib/fx-rate";

/**
 * Money & cash-flow cockpit — the business-level financial picture.
 *
 * Aggregates four sources into one "where's my money" view:
 *   - cars + car_costs   → capital sitting as inventory (at cost), list value,
 *                          unrealized margin on the lot, realized margin on sold
 *   - payments (state 2) → deposits collected (cash in)
 *   - purchase_orders    → capital committed to suppliers / in transit, by status
 *   - fx_rate            → USD/CNY/UZS rates for the 3-currency exposure
 * Read-only, admin-gated, service-role.
 */
const MAX_ROWS = 5000;
const ACTIVE_PO = new Set(["ordered", "in_production", "shipped"]);

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();
    const [carsRes, costsRes, paymentsRes, poRes, fx] = await Promise.all([
      supabase.from("cars").select("id, price_usd, inventory_status").limit(MAX_ROWS),
      supabase.from("car_costs").select("car_id, cost_usd").limit(MAX_ROWS),
      // Paginate the deposit sum so it doesn't silently undercount past the cap.
      fetchAllRows<{ amount_tiyin: number }>((from, to) =>
        supabase.from("payments").select("amount_tiyin").eq("state", 2).range(from, to),
      ).then((data) => ({ data })),
      supabase.from("purchase_orders").select("status, qty, unit_cost_usd").limit(MAX_ROWS),
      getFxRates(supabase),
    ]);

    const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

    const costByCar = new Map<string, number>();
    for (const c of costsRes.data || []) costByCar.set(c.car_id as string, num(c.cost_usd));

    let inventoryAtCost = 0;
    let inventoryList = 0;
    let potentialMargin = 0;
    let realizedMargin = 0;
    let onLotCount = 0;
    let soldCount = 0;
    for (const car of carsRes.data || []) {
      const cost = costByCar.get(car.id as string);
      if (cost == null) continue; // only tracked cars contribute to money math
      const price = num(car.price_usd);
      const status = (car.inventory_status as string) || "available";
      if (status === "sold") {
        soldCount += 1;
        realizedMargin += price - cost;
      } else {
        onLotCount += 1;
        inventoryAtCost += cost;
        inventoryList += price;
        potentialMargin += price - cost;
      }
    }

    const depositsTiyin = (paymentsRes.data || []).reduce((a, p) => a + num(p.amount_tiyin), 0);
    const depositsUzs = Math.round(depositsTiyin / 100);

    // Purchase orders: committed (in transit) vs draft pipeline.
    const poByStatus: Record<string, { count: number; valueUsd: number }> = {};
    let committedUsd = 0;
    let pipelineUsd = 0;
    for (const po of poRes.data || []) {
      const status = (po.status as string) || "draft";
      const value = num(po.unit_cost_usd) * num(po.qty);
      poByStatus[status] = poByStatus[status] || { count: 0, valueUsd: 0 };
      poByStatus[status].count += 1;
      poByStatus[status].valueUsd += value;
      if (ACTIVE_PO.has(status)) committedUsd += value;
      else if (status === "draft") pipelineUsd += value;
    }

    return NextResponse.json({
      ok: true,
      fx,
      inventory: {
        onLotCount,
        soldCount,
        atCostUsd: Math.round(inventoryAtCost),
        listValueUsd: Math.round(inventoryList),
        potentialMarginUsd: Math.round(potentialMargin),
        realizedMarginUsd: Math.round(realizedMargin),
      },
      cash: {
        depositsCollectedUzs: depositsUzs,
        depositsCollectedUsd: fx.usd_uzs > 0 ? Math.round(depositsUzs / fx.usd_uzs) : 0,
      },
      suppliers: {
        committedUsd: Math.round(committedUsd),
        pipelineUsd: Math.round(pipelineUsd),
        byStatus: Object.fromEntries(
          Object.entries(poByStatus).map(([k, v]) => [k, { count: v.count, valueUsd: Math.round(v.valueUsd) }]),
        ),
      },
      // FX exposure: USD-denominated supplier capital, expressed in UZS now and
      // if the soum weakened 5% (illustrative downside on what you still owe/ship).
      exposure: {
        usdAtRisk: Math.round(committedUsd),
        uzsNow: Math.round(committedUsd * fx.usd_uzs),
        uzsAtMinus5pct: Math.round(committedUsd * fx.usd_uzs * 1.05),
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to compute money cockpit" }, { status: 500 });
  }
}
