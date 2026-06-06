import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchAllRows } from "@/lib/supabase/paginate";

/**
 * Per-car profit ledger — the financial-automation view.
 *
 * Joins each car to its tracked purchase cost (car_costs, service-role only) to
 * show cost → list price → gross margin, plus business totals: inventory value
 * at cost, unrealized margin still on the lot, realized margin on sold units,
 * and deposits collected to date. Read-only, admin-gated.
 */
const MAX_ROWS = 5000;

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();

    const [carsRes, costsRes, paymentsRes] = await Promise.all([
      supabase.from("cars").select("id, brand, model, year, price_usd, inventory_status").limit(MAX_ROWS),
      supabase.from("car_costs").select("car_id, cost_usd").limit(MAX_ROWS),
      // Paginate the deposit sum so it doesn't silently undercount past the cap.
      fetchAllRows<{ amount_tiyin: number }>((from, to) =>
        supabase.from("payments").select("amount_tiyin").eq("state", 2).range(from, to),
      ).then((data) => ({ data })),
    ]);

    const costByCar = new Map<string, number>();
    for (const c of costsRes.data || []) {
      const v = typeof c.cost_usd === "number" ? c.cost_usd : Number(c.cost_usd);
      if (Number.isFinite(v)) costByCar.set(c.car_id as string, v);
    }

    const rows = (carsRes.data || [])
      .map((car) => {
        const cost = costByCar.get(car.id as string) ?? null;
        const price = typeof car.price_usd === "number" ? car.price_usd : Number(car.price_usd) || 0;
        const margin = cost != null ? price - cost : null;
        const marginPct = cost != null && cost > 0 ? Math.round(((margin as number) / cost) * 1000) / 10 : null;
        return {
          car_id: car.id as string,
          brand: car.brand as string,
          model: car.model as string,
          year: (car.year as number) ?? null,
          inventory_status: (car.inventory_status as string) ?? "available",
          cost_usd: cost,
          price_usd: price,
          margin_usd: margin,
          margin_pct: marginPct,
        };
      })
      // Tracked cars (with a cost) first, ranked by margin; untracked after.
      .sort((a, b) => {
        if ((a.cost_usd != null) !== (b.cost_usd != null)) return a.cost_usd != null ? -1 : 1;
        if (a.cost_usd != null && b.cost_usd != null) return (b.margin_usd ?? 0) - (a.margin_usd ?? 0);
        return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`);
      });

    const tracked = rows.filter((r) => r.cost_usd != null);
    const onLot = tracked.filter((r) => r.inventory_status === "available" || r.inventory_status === "reserved");
    const sold = tracked.filter((r) => r.inventory_status === "sold");
    const sum = (arr: typeof rows, f: (r: (typeof rows)[number]) => number) => arr.reduce((a, r) => a + f(r), 0);

    const depositsTiyin = (paymentsRes.data || []).reduce((a, p) => {
      const v = typeof p.amount_tiyin === "number" ? p.amount_tiyin : Number(p.amount_tiyin);
      return a + (Number.isFinite(v) ? v : 0);
    }, 0);

    return NextResponse.json({
      ok: true,
      totals: {
        trackedCars: tracked.length,
        inventoryAtCostUsd: Math.round(sum(onLot, (r) => r.cost_usd ?? 0)),
        inventoryListUsd: Math.round(sum(onLot, (r) => r.price_usd)),
        potentialMarginUsd: Math.round(sum(onLot, (r) => r.margin_usd ?? 0)),
        soldCars: sold.length,
        realizedMarginUsd: Math.round(sum(sold, (r) => r.margin_usd ?? 0)),
        depositsCollectedUzs: Math.round(depositsTiyin / 100),
      },
      rows,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to compute ledger" }, { status: 500 });
  }
}
