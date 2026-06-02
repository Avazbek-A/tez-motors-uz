import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Supplier price-history intelligence — turns the procurement log into cost
 * trends: per-model min/avg/max/latest unit cost, per-supplier averages, and
 * "cost rising" alerts (latest meaningfully above the historical average).
 * Read-only, admin-gated.
 */
const RISING_THRESHOLD = 1.05; // latest > avg * 1.05 ⇒ flag
const MAX_ROWS = 5000;

interface PORow {
  supplier: string | null;
  brand: string;
  model: string;
  unit_cost_usd: number | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("purchase_orders")
      .select("supplier, brand, model, unit_cost_usd, created_at")
      .order("created_at", { ascending: true })
      .limit(MAX_ROWS);

    const rows = ((data || []) as PORow[]).filter(
      (r) => typeof r.unit_cost_usd === "number" && Number.isFinite(r.unit_cost_usd),
    );

    // Per model (brand + model).
    const byModelMap = new Map<string, { brand: string; model: string; costs: number[]; latest: number; latestAt: string }>();
    for (const r of rows) {
      const key = `${r.brand} ${r.model}`;
      const cost = r.unit_cost_usd as number;
      const e = byModelMap.get(key);
      if (e) {
        e.costs.push(cost);
        e.latest = cost; // rows are ascending by created_at, so last seen = latest
        e.latestAt = r.created_at;
      } else {
        byModelMap.set(key, { brand: r.brand, model: r.model, costs: [cost], latest: cost, latestAt: r.created_at });
      }
    }
    const byModel = Array.from(byModelMap.values())
      .map((e) => {
        const avg = e.costs.reduce((a, b) => a + b, 0) / e.costs.length;
        return {
          brand: e.brand,
          model: e.model,
          orders: e.costs.length,
          minCost: Math.round(Math.min(...e.costs)),
          avgCost: Math.round(avg),
          maxCost: Math.round(Math.max(...e.costs)),
          latestCost: Math.round(e.latest),
          trendPct: avg > 0 ? Math.round(((e.latest - avg) / avg) * 1000) / 10 : 0,
          rising: e.costs.length >= 2 && e.latest > avg * RISING_THRESHOLD,
        };
      })
      .sort((a, b) => b.orders - a.orders);

    // Per supplier.
    const bySupplierMap = new Map<string, { costs: number[]; models: Set<string> }>();
    for (const r of rows) {
      const key = r.supplier?.trim() || "Unknown";
      const cost = r.unit_cost_usd as number;
      const e = bySupplierMap.get(key) || { costs: [], models: new Set<string>() };
      e.costs.push(cost);
      e.models.add(`${r.brand} ${r.model}`);
      bySupplierMap.set(key, e);
    }
    const bySupplier = Array.from(bySupplierMap.entries())
      .map(([supplier, e]) => ({
        supplier,
        orders: e.costs.length,
        models: e.models.size,
        avgCost: Math.round(e.costs.reduce((a, b) => a + b, 0) / e.costs.length),
      }))
      .sort((a, b) => b.orders - a.orders);

    const alerts = byModel.filter((m) => m.rising);

    return NextResponse.json({ ok: true, byModel, bySupplier, alerts, totalOrders: rows.length });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to compute supplier intelligence" }, { status: 500 });
  }
}
