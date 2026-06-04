import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { alertDealer, logEvent } from "@/lib/error-report";
import { resolveAutopilot, sourceAllowed, AUTOPILOT_ROW_ID } from "@/lib/autopilot";
import { createDraftPo } from "@/lib/copilot/actions";

/**
 * Autopilot — demand → DRAFT purchase orders (Phase AH). Opt-in, capped. Creates
 * only DRAFT POs (never 'ordered' — the dealer reviews + sends), for in-demand
 * models that are out of stock and not already drafted. Reuses the audited
 * createDraftPo op. Safe: no money moves, no auto-ordering.
 */
export async function POST(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  const supabase = createServiceClient();
  const { data: cfgRow } = await supabase.from("site_settings").select("values").eq("id", AUTOPILOT_ROW_ID).maybeSingle();
  const cfg = resolveAutopilot(cfgRow?.values);
  if (!sourceAllowed(cfg)) return NextResponse.json({ ok: true, skipped: "disabled" });

  const thirtyAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [inqRes, carsRes, poRes] = await Promise.all([
    supabase.from("inquiries").select("car_id, cars(brand, model)").not("car_id", "is", null).gte("created_at", thirtyAgo).limit(5000),
    supabase.from("cars").select("brand, model, inventory_status").limit(3000),
    supabase.from("purchase_orders").select("brand, model, status").limit(2000),
  ]);

  // Demand per "brand|model" (inquiry count over 30d).
  const demand = new Map<string, { brand: string; model: string; score: number }>();
  for (const i of inqRes.data || []) {
    const rel = i.cars as { brand: string; model: string } | { brand: string; model: string }[] | null;
    const car = Array.isArray(rel) ? rel[0] : rel;
    if (!car) continue;
    const key = `${car.brand}|${car.model}`.toLowerCase();
    const cur = demand.get(key) || { brand: car.brand, model: car.model, score: 0 };
    cur.score += 1;
    demand.set(key, cur);
  }

  // In-stock and already-drafted models (skip these).
  const inStock = new Set<string>();
  for (const c of carsRes.data || []) if (c.inventory_status === "available") inStock.add(`${c.brand}|${c.model}`.toLowerCase());
  const drafted = new Set<string>();
  for (const p of poRes.data || []) if (p.status === "draft" || p.status === "ordered" || p.status === "in_production") drafted.add(`${p.brand}|${p.model}`.toLowerCase());

  const targets = Array.from(demand.entries())
    .filter(([key, d]) => d.score >= cfg.autoSourceDrafts.minDemandScore && !inStock.has(key) && !drafted.has(key))
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, cfg.autoSourceDrafts.maxPerRun);

  const created: string[] = [];
  for (const [, d] of targets) {
    const res = await createDraftPo(supabase, { brand: d.brand, model: d.model, qty: 1 });
    if (res.ok) created.push(`${d.brand} ${d.model} (спрос ${d.score})`);
  }
  if (created.length) await alertDealer(`🤖 Автопилот создал ${created.length} черновик(ов) заявок`, [...created, "Проверьте «Закупки» и отправьте.", "Отключить: Настройки → Автопилот."], { key: "auto-source" });
  logEvent("autopilot.source", { created: created.length });
  return NextResponse.json({ ok: true, created: created.length, items: created });
}
