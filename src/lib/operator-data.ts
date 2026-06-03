/**
 * Server-side gather for the AI Operator briefing — assembles the OperatorContext
 * from the live business data (action queue, cash, aged stock, demand). Shared by
 * the /api/admin/operator route and the daily cron. Fail-soft per section.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getFxRates } from "./fx-rate";
import { agingSuggestion } from "./inventory-aging";
import type { OperatorContext } from "./operator";

const MAX = 5000;
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

export async function gatherOperatorContext(supabase: SupabaseClient): Promise<OperatorContext> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const today = nowIso.slice(0, 10);
  const oneDayAgo = new Date(now - 86_400_000).toISOString();
  const in30 = new Date(now + 30 * 86_400_000).toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const thirtyAgo = new Date(now - 30 * 86_400_000).toISOString();
  const headCount = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0, () => 0);

  const [
    newInquiries, hotLeads, tasksDue, unpaidReservations, overdueShipments, warrantiesExpiring,
    paymentsRes, poRes, carsRes, costsRes, invoicesRes, recentInqRes, fx,
  ] = await Promise.all([
    headCount(supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("status", "new")),
    headCount(supabase.from("assistant_conversations").select("*", { count: "exact", head: true }).eq("handoff", true)),
    headCount(supabase.from("crm_tasks").select("*", { count: "exact", head: true }).eq("status", "open").lte("due_at", nowIso)),
    headCount(supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "ordered").lt("created_at", oneDayAgo)),
    headCount(supabase.from("shipments").select("*", { count: "exact", head: true }).neq("status", "delivered").not("eta_date", "is", null).lt("eta_date", today)),
    headCount(supabase.from("warranties").select("*", { count: "exact", head: true }).gte("warranty_until", today).lte("warranty_until", in30)),
    supabase.from("payments").select("amount_tiyin").eq("state", 2).limit(MAX).then((r) => r.data ?? [], () => []),
    supabase.from("purchase_orders").select("status, qty, unit_cost_usd").limit(MAX).then((r) => r.data ?? [], () => []),
    supabase.from("cars").select("id, brand, model, year, price_usd, inventory_status, created_at").limit(MAX).then((r) => r.data ?? [], () => []),
    supabase.from("car_costs").select("car_id, cost_usd").limit(MAX).then((r) => r.data ?? [], () => []),
    supabase.from("invoices").select("total_usd, status, issued_at").eq("status", "paid").gte("issued_at", monthStart).limit(MAX).then((r) => r.data ?? [], () => []),
    supabase.from("inquiries").select("car_id, created_at").not("car_id", "is", null).gte("created_at", thirtyAgo).limit(MAX).then((r) => r.data ?? [], () => []),
    getFxRates(supabase),
  ]);

  // Money.
  const depositsUzs = Math.round((paymentsRes as { amount_tiyin: number }[]).reduce((a, p) => a + num(p.amount_tiyin), 0) / 100);
  const ACTIVE = new Set(["ordered", "in_production", "shipped"]);
  const committedSupplierUsd = Math.round((poRes as { status: string; qty: number; unit_cost_usd: number }[]).filter((p) => ACTIVE.has(p.status)).reduce((a, p) => a + num(p.unit_cost_usd) * num(p.qty), 0));
  const costByCar = new Map<string, number>();
  for (const c of costsRes as { car_id: string; cost_usd: number }[]) costByCar.set(c.car_id, num(c.cost_usd));
  const cars = carsRes as { id: string; brand: string; model: string; year: number | null; price_usd: number; inventory_status: string; created_at: string }[];
  let potentialMarginUsd = 0;
  for (const c of cars) { const cost = costByCar.get(c.id); if (cost != null && c.inventory_status !== "sold") potentialMarginUsd += num(c.price_usd) - cost; }
  const revenueMtdUsd = Math.round((invoicesRes as { total_usd: number }[]).reduce((a, i) => a + num(i.total_usd), 0));

  // Demand per car (last 30d) → top models.
  const inqByCar = new Map<string, number>();
  for (const r of recentInqRes as { car_id: string }[]) inqByCar.set(r.car_id, (inqByCar.get(r.car_id) || 0) + 1);
  const carName = new Map<string, string>();
  for (const c of cars) carName.set(c.id, `${c.brand} ${c.model}${c.year ? ` ${c.year}` : ""}`);
  const topDemand = Array.from(inqByCar.entries())
    .map(([id, inquiries]) => ({ name: carName.get(id) || "car", inquiries }))
    .sort((a, b) => b.inquiries - a.inquiries)
    .slice(0, 3);

  // Aged stock → markdown suggestions (same engine as inventory-aging).
  const topMarkdowns = cars
    .filter((c) => c.inventory_status === "available")
    .map((c) => {
      const daysOnLot = Math.floor((now - new Date(c.created_at).getTime()) / 86_400_000);
      const demandScore = (inqByCar.get(c.id) || 0) * 5;
      const s = agingSuggestion({ price_usd: num(c.price_usd), daysOnLot, demandScore });
      return { carId: c.id, name: carName.get(c.id) || "car", daysOnLot, markdownPct: s.markdownPct, suggestedPriceUsd: s.suggestedPriceUsd, currentPriceUsd: num(c.price_usd) };
    })
    .filter((m) => m.markdownPct > 0)
    .sort((a, b) => b.daysOnLot - a.daysOnLot)
    .slice(0, 3);

  return {
    actions: { newInquiries, hotLeads, tasksDue, unpaidReservations, overdueShipments, warrantiesExpiring },
    money: { revenueMtdUsd, depositsUsd: fx.usd_uzs > 0 ? Math.round(depositsUzs / fx.usd_uzs) : 0, committedSupplierUsd, potentialMarginUsd: Math.round(potentialMarginUsd) },
    topMarkdowns,
    topDemand,
  };
}
