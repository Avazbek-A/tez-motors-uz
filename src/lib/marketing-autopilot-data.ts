/**
 * Server-side gather for the Marketing Autopilot — reads the live business state
 * (aged stock, new arrivals, demand, active promos) and shapes it into the
 * MarketingSignals the pure suggestion engine consumes. Fail-soft per section so
 * a single bad query never breaks the whole briefing. Shared by the admin
 * suggestions route and the weekly autopilot cron.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarketingSignals } from "./marketing-autopilot";

const MAX = 5000;
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

interface CarRow {
  id: string;
  brand: string;
  model: string;
  year: number | null;
  price_usd: number;
  inventory_status: string;
  created_at: string;
}

function carName(c: { brand: string; model: string; year: number | null }): string {
  return `${c.brand} ${c.model}${c.year ? ` ${c.year}` : ""}`;
}

export async function gatherMarketingSignals(supabase: SupabaseClient): Promise<MarketingSignals> {
  const now = Date.now();
  const thirtyAgo = new Date(now - 30 * 86_400_000).toISOString();

  const [carsRes, recentInqRes, promosRes] = await Promise.all([
    supabase
      .from("cars")
      .select("id, brand, model, year, price_usd, inventory_status, created_at")
      .limit(MAX)
      .then((r) => (r.data ?? []) as CarRow[], () => [] as CarRow[]),
    supabase
      .from("inquiries")
      .select("car_id, created_at")
      .not("car_id", "is", null)
      .gte("created_at", thirtyAgo)
      .limit(MAX)
      .then((r) => (r.data ?? []) as { car_id: string }[], () => [] as { car_id: string }[]),
    supabase
      .from("promotions")
      .select("car_id, label, sale_price_usd, status")
      .eq("status", "active")
      .limit(500)
      .then((r) => (r.data ?? []) as { car_id: string; label: string | null; sale_price_usd: number }[], () => []),
  ]);

  const byId = new Map<string, CarRow>();
  for (const c of carsRes) byId.set(c.id, c);

  const available = carsRes.filter((c) => c.inventory_status === "available");

  const withDays = available.map((c) => ({
    carId: c.id,
    name: carName(c),
    daysOnLot: Math.floor((now - new Date(c.created_at).getTime()) / 86_400_000),
    priceUsd: num(c.price_usd),
  }));

  const agedStock = [...withDays].sort((a, b) => b.daysOnLot - a.daysOnLot);
  const newArrivals = [...withDays].sort((a, b) => a.daysOnLot - b.daysOnLot);

  // Demand per car over the last 30 days.
  const inqByCar = new Map<string, number>();
  for (const r of recentInqRes) inqByCar.set(r.car_id, (inqByCar.get(r.car_id) || 0) + 1);
  const hotDemand = Array.from(inqByCar.entries())
    .map(([carId, inquiries]) => ({ carId, name: byId.has(carId) ? carName(byId.get(carId)!) : "car", inquiries }))
    .filter((d) => byId.has(d.carId))
    .sort((a, b) => b.inquiries - a.inquiries)
    .slice(0, 5);

  const activePromos = promosRes
    .filter((p) => byId.has(p.car_id))
    .map((p) => ({ carId: p.car_id, name: carName(byId.get(p.car_id)!), label: p.label, salePriceUsd: num(p.sale_price_usd) }));

  return { agedStock, newArrivals, hotDemand, activePromos };
}
