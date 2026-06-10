import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getFxRates } from "@/lib/fx-rate";
import { arAging, bucketByAge, depositsHeldAsLiability, cashRunway, dealPnl, fxExposureScenarios } from "@/lib/finance-forecast";
import { fetchAllRows } from "@/lib/supabase/paginate";

/**
 * Financial foresight (Phase AG) — forward-looking cash view. Admin-gated,
 * service-role, read-only. Snapshot → forecast: runway, AR/AP aging, deposits
 * held as liability, per-deal P&L lifecycle, FX exposure scenarios. Fail-soft per
 * query so one outage doesn't blank the whole report.
 */
const MAX = 5000;
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const supabase = createServiceClient();
  const now = Date.now();
  const monthAgo = new Date(now - 30 * 86_400_000).toISOString();

  const safe = <T>(p: PromiseLike<{ data: T | null }>, d: T) => p.then((r) => r.data ?? d, () => d);

  const [invoices, payments, orders, costs, expenses, pos, fx] = await Promise.all([
    fetchAllRows<{ total_usd: number; status: string; due_at: string | null; issued_at: string | null }>((from, to) =>
      supabase.from("invoices").select("total_usd, status, due_at, issued_at").range(from, to)),
    // Paginate the deposit rows so cashNow / depositsByOrder don't undercount past the cap.
    fetchAllRows<{ amount_tiyin: number; state: number; order_id: string | null }>((from, to) =>
      supabase.from("payments").select("amount_tiyin, state, order_id").eq("state", 2).range(from, to)),
    fetchAllRows<{ id: string; reference_code: string; status: string; amount_usd: number | null; car_id: string | null; cars: { brand: string; model: string; year: number }[] }>((from, to) =>
      supabase.from("orders").select("id, reference_code, status, amount_usd, car_id, cars(brand, model, year)").order("created_at", { ascending: false }).range(from, to)),
    fetchAllRows<{ car_id: string; cost_usd: number }>((from, to) =>
      supabase.from("car_costs").select("car_id, cost_usd").range(from, to)),
    safe(supabase.from("expenses").select("amount_usd, spent_on").gte("spent_on", monthAgo.slice(0, 10)).limit(MAX), [] as { amount_usd: number; spent_on: string }[]),
    fetchAllRows<{ status: string; qty: number; unit_cost_usd: number | null; eta_date: string | null; created_at: string }>((from, to) =>
      supabase.from("purchase_orders").select("status, qty, unit_cost_usd, eta_date, created_at").range(from, to)),
    getFxRates(supabase),
  ]);

  // Cash now ≈ deposits collected (the liquid cash the dealer holds). USD via FX.
  const depositsUzs = payments.reduce((a, p) => a + num(p.amount_tiyin), 0) / 100;
  const cashNowUsd = fx.usd_uzs > 0 ? depositsUzs / fx.usd_uzs : 0;
  const depositsByOrder = new Map<string, number>();
  for (const p of payments) if (p.order_id) depositsByOrder.set(p.order_id, (depositsByOrder.get(p.order_id) || 0) + (fx.usd_uzs > 0 ? num(p.amount_tiyin) / 100 / fx.usd_uzs : 0));

  // Inflow run-rate: paid invoices over the last 30d. Outflow: expenses last 30d.
  // The `invoices` query is unfiltered by date (arAging needs all unpaid ones),
  // so filter to the last 30 days HERE by issued_at — otherwise this sums ALL
  // paid invoices ever as the "monthly" inflow, making net burn look positive
  // and hiding a real cash crunch (runwayMonths → null/"not burning").
  const inflow30 = invoices
    .filter((i) => i.status === "paid" && i.issued_at && new Date(i.issued_at).getTime() >= now - 30 * 86_400_000)
    .reduce((a, i) => a + num(i.total_usd), 0); // gross approximation
  const monthlyInflowUsd = Math.round(inflow30);
  const monthlyOutflowUsd = Math.round(expenses.reduce((a, e) => a + num(e.amount_usd), 0));

  // AP: active PO commitments not yet paid, aged by eta (else created).
  const ACTIVE = new Set(["ordered", "in_production", "shipped"]);
  const ap = bucketByAge(
    pos.filter((p) => ACTIVE.has(p.status)).map((p) => ({ amountUsd: num(p.unit_cost_usd) * num(p.qty), refMs: new Date(p.eta_date || p.created_at).getTime() })),
    now,
  );
  const committedUsd = pos.filter((p) => ACTIVE.has(p.status)).reduce((a, p) => a + num(p.unit_cost_usd) * num(p.qty), 0);

  const costByCar = new Map<string, number>();
  for (const c of costs) costByCar.set(c.car_id, num(c.cost_usd));

  const deals = orders.slice(0, 50).map((o) => {
    const carRel = o.cars;
    const car = Array.isArray(carRel) ? carRel[0] : carRel;
    const carName = car ? `${car.brand} ${car.model} ${car.year ?? ""}`.trim() : "—";
    const cost = o.car_id ? costByCar.get(o.car_id) ?? null : null;
    return dealPnl({ id: o.id, reference_code: o.reference_code, status: o.status, amount_usd: o.amount_usd, car: carName }, cost, depositsByOrder.get(o.id) || 0);
  });

  return NextResponse.json({
    ok: true,
    fx: { usd_uzs: fx.usd_uzs },
    runway: cashRunway(cashNowUsd, monthlyInflowUsd, monthlyOutflowUsd),
    arAging: arAging(invoices, now),
    apAging: ap,
    depositsHeldUsd: depositsHeldAsLiability(orders, depositsByOrder),
    fxExposure: fxExposureScenarios(Math.round(committedUsd), fx.usd_uzs),
    deals,
  });
}
