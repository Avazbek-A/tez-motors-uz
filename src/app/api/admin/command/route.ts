import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getFxRates } from "@/lib/fx-rate";

/**
 * Owner command center — the morning briefing. One compact payload with the
 * action list (what needs attention today) + a cash snapshot + recent leads,
 * stitched across tasks, conversations, shipments, orders, inquiries, payments,
 * purchase orders, car costs and invoices. Each section is fail-soft so one
 * slow/missing table can't blank the whole screen. Read-only, admin-gated.
 */
const MAX = 5000;
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const supabase = createServiceClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const today = nowIso.slice(0, 10);
  const oneDayAgo = new Date(now.getTime() - 86_400_000).toISOString();
  const in30 = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const headCount = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0, () => 0);

  const [
    tasksDue,
    hotLeads,
    overdueShipments,
    unpaidReservations,
    newInquiries,
    warrantiesExpiring,
    paymentsRes,
    poRes,
    carsRes,
    costsRes,
    invoicesRes,
    recentInqRes,
    recentLeadRes,
    fx,
  ] = await Promise.all([
    headCount(supabase.from("crm_tasks").select("*", { count: "exact", head: true }).eq("status", "open").lte("due_at", nowIso)),
    headCount(supabase.from("assistant_conversations").select("*", { count: "exact", head: true }).eq("handoff", true)),
    headCount(supabase.from("shipments").select("*", { count: "exact", head: true }).neq("status", "delivered").not("eta_date", "is", null).lt("eta_date", today)),
    headCount(supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "ordered").lt("created_at", oneDayAgo)),
    headCount(supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("status", "new")),
    headCount(supabase.from("warranties").select("*", { count: "exact", head: true }).gte("warranty_until", today).lte("warranty_until", in30)),
    supabase.from("payments").select("amount_tiyin").eq("state", 2).limit(MAX).then((r) => r.data ?? [], () => []),
    supabase.from("purchase_orders").select("status, qty, unit_cost_usd").limit(MAX).then((r) => r.data ?? [], () => []),
    supabase.from("cars").select("id, price_usd, inventory_status").limit(MAX).then((r) => r.data ?? [], () => []),
    supabase.from("car_costs").select("car_id, cost_usd").limit(MAX).then((r) => r.data ?? [], () => []),
    supabase.from("invoices").select("total_usd, status, issued_at").eq("status", "paid").gte("issued_at", monthStart).limit(MAX).then((r) => r.data ?? [], () => []),
    supabase.from("inquiries").select("name, phone, type, status, created_at").order("created_at", { ascending: false }).limit(6).then((r) => r.data ?? [], () => []),
    supabase.from("assistant_conversations").select("name, phone, lead_score, stage").eq("handoff", true).order("lead_score", { ascending: false }).limit(6).then((r) => r.data ?? [], () => []),
    getFxRates(supabase),
  ]);

  // Cash snapshot.
  const depositsUzs = Math.round((paymentsRes as { amount_tiyin: number }[]).reduce((a, p) => a + num(p.amount_tiyin), 0) / 100);
  const ACTIVE_PO = new Set(["ordered", "in_production", "shipped"]);
  const committedSupplierUsd = Math.round(
    (poRes as { status: string; qty: number; unit_cost_usd: number }[])
      .filter((p) => ACTIVE_PO.has(p.status))
      .reduce((a, p) => a + num(p.unit_cost_usd) * num(p.qty), 0),
  );
  const costByCar = new Map<string, number>();
  for (const c of costsRes as { car_id: string; cost_usd: number }[]) costByCar.set(c.car_id, num(c.cost_usd));
  let potentialMarginUsd = 0;
  for (const car of carsRes as { id: string; price_usd: number; inventory_status: string }[]) {
    const cost = costByCar.get(car.id);
    if (cost != null && car.inventory_status !== "sold") potentialMarginUsd += num(car.price_usd) - cost;
  }
  const revenueMtdUsd = Math.round((invoicesRes as { total_usd: number }[]).reduce((a, i) => a + num(i.total_usd), 0));

  return NextResponse.json({
    ok: true,
    fx,
    actions: { tasksDue, hotLeads, overdueShipments, unpaidReservations, newInquiries, warrantiesExpiring },
    money: {
      revenueMtdUsd,
      depositsUzs,
      depositsUsd: fx.usd_uzs > 0 ? Math.round(depositsUzs / fx.usd_uzs) : 0,
      committedSupplierUsd,
      potentialMarginUsd: Math.round(potentialMarginUsd),
    },
    recentInquiries: recentInqRes,
    hotLeads: recentLeadRes,
  });
}
