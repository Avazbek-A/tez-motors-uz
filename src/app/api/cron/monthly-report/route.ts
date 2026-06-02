import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { sendDealerDigest } from "@/lib/cron/dealer-digest";
import { logEvent, reportServerError } from "@/lib/error-report";

/**
 * Monthly financial + activity report to the owner: last 30 days of leads,
 * orders, deposits collected, and an inventory snapshot (value at cost +
 * unrealized margin from the profit ledger). Read-only; delivered via the
 * shared dealer-digest channel.
 */
const MAX = 5000;
const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const uzs = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " сум";

async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const supabase = createServiceClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [leadsRes, ordersRes, deliveredRes, paymentsRes, carsRes, costsRes] = await Promise.all([
      supabase.from("inquiries").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "delivered").gte("updated_at", since),
      supabase.from("payments").select("amount_tiyin").eq("state", 2).gte("created_at", since).limit(MAX),
      supabase.from("cars").select("id, price_usd, inventory_status").eq("inventory_status", "available").limit(MAX),
      supabase.from("car_costs").select("car_id, cost_usd").limit(MAX),
    ]);

    const depositsUzs = (paymentsRes.data || []).reduce((a, p) => {
      const v = typeof p.amount_tiyin === "number" ? p.amount_tiyin : Number(p.amount_tiyin);
      return a + (Number.isFinite(v) ? v : 0);
    }, 0) / 100;

    const costByCar = new Map<string, number>();
    for (const c of costsRes.data || []) {
      const v = typeof c.cost_usd === "number" ? c.cost_usd : Number(c.cost_usd);
      if (Number.isFinite(v)) costByCar.set(c.car_id as string, v);
    }
    let invAtCost = 0;
    let potentialMargin = 0;
    for (const car of carsRes.data || []) {
      const cost = costByCar.get(car.id as string);
      if (cost == null) continue;
      const price = typeof car.price_usd === "number" ? car.price_usd : Number(car.price_usd) || 0;
      invAtCost += cost;
      potentialMargin += price - cost;
    }

    const lines = [
      "Last 30 days:",
      `🆕 New leads: ${leadsRes.count ?? 0}`,
      `📦 New orders: ${ordersRes.count ?? 0}`,
      `✅ Delivered: ${deliveredRes.count ?? 0}`,
      `💳 Deposits collected: ${uzs(depositsUzs)}`,
      "",
      "Inventory (tracked-cost, available):",
      `🏷️ Value at cost: ${usd(invAtCost)}`,
      `📈 Unrealized margin on lot: ${usd(potentialMargin)}`,
    ];
    await sendDealerDigest("Monthly report — Tez Motors", lines);

    logEvent("cron.monthly_report", {
      leads: leadsRes.count ?? 0,
      orders: ordersRes.count ?? 0,
      delivered: deliveredRes.count ?? 0,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    reportServerError("GET /api/cron/monthly-report", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
