import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { alertDealer, logEvent } from "@/lib/error-report";
import { resolveAutopilot, sourceAllowed, AUTOPILOT_ROW_ID } from "@/lib/autopilot";
import { createDraftPo } from "@/lib/copilot/actions";
import { aggregatePreorderDemand } from "@/lib/procurement-demand";

/**
 * Autopilot — demand → DRAFT purchase orders (Phase AH). Opt-in, capped. Creates
 * only DRAFT POs (never 'ordered' — the dealer reviews + sends), for in-demand
 * models that are out of stock and not already drafted. Reuses the audited
 * createDraftPo op. Safe: no money moves, no auto-ordering.
 *
 * Demand fuses two sources: 30-day inquiry counts on stocked cars AND open
 * pre-orders by model (AH-amendment). A DEPOSITED pre-order is the strongest
 * signal — money is down on an exact made-to-order config — so it weighs heavily
 * and, unlike soft inquiry demand, fires even when generic stock exists (the
 * buyer wants their specific config). The draft qty is floored at the deposited
 * count so we never under-order what's already pre-sold.
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
  const demand = new Map<string, { brand: string; model: string; score: number; deposited: number; needsImport: number }>();
  for (const i of inqRes.data || []) {
    const rel = i.cars as { brand: string; model: string } | { brand: string; model: string }[] | null;
    const car = Array.isArray(rel) ? rel[0] : rel;
    if (!car) continue;
    const key = `${car.brand}|${car.model}`.toLowerCase();
    const cur = demand.get(key) || { brand: car.brand, model: car.model, score: 0, deposited: 0, needsImport: 0 };
    cur.score += 1;
    demand.set(key, cur);
  }

  // Fold in pre-order demand (deposited = committed). Deposited pre-orders weigh
  // ×5, pending ×2 — so even a couple of paid pre-orders cross the threshold.
  const preorder = await aggregatePreorderDemand(supabase);
  for (const [key, pd] of preorder) {
    const cur = demand.get(key) || { brand: pd.brand, model: pd.model, score: 0, deposited: 0, needsImport: 0 };
    cur.score += pd.deposited * 5 + (pd.total - pd.deposited) * 2;
    cur.deposited += pd.deposited;
    cur.needsImport += pd.needsImport;
    demand.set(key, cur);
  }

  // In-stock and already-drafted models (skip these).
  const inStock = new Set<string>();
  for (const c of carsRes.data || []) if (c.inventory_status === "available") inStock.add(`${c.brand}|${c.model}`.toLowerCase());
  const drafted = new Set<string>();
  for (const p of poRes.data || []) if (p.status === "draft" || p.status === "ordered" || p.status === "in_production") drafted.add(`${p.brand}|${p.model}`.toLowerCase());

  const targets = Array.from(demand.entries())
    .filter(([key, d]) => {
      if (drafted.has(key)) return false;
      if (d.score < cfg.autoSourceDrafts.minDemandScore) return false;
      // Deposited buyers STILL NEEDING import (deposit_paid, not yet sourcing)
      // want a specific config — import even if generic stock exists. Soft
      // (inquiry-only) demand, and demand already being sourced, honor the
      // in-stock skip. Using needsImport (not deposited) avoids re-importing
      // pre-orders that are already in 'sourcing'.
      if (inStock.has(key) && d.needsImport === 0) return false;
      return true;
    })
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, cfg.autoSourceDrafts.maxPerRun);

  const created: string[] = [];
  for (const [, d] of targets) {
    // Order only what still needs importing (deposit_paid pre-orders not yet in
    // 'sourcing') so we don't draft a PO to re-order units already being
    // procured. createDraftPo clamps to [1,100].
    const qty = Math.max(1, d.needsImport);
    const res = await createDraftPo(supabase, { brand: d.brand, model: d.model, qty });
    if (res.ok) {
      created.push(`${d.brand} ${d.model} (спрос ${d.score}${d.deposited ? `, депозитов: ${d.deposited}` : ""})`);
    }
  }
  if (created.length) await alertDealer(`🤖 Автопилот создал ${created.length} черновик(ов) заявок`, [...created, "Проверьте «Закупки» и отправьте.", "Отключить: Настройки → Автопилот."], { key: "auto-source" });
  logEvent("autopilot.source", { created: created.length });
  return NextResponse.json({ ok: true, created: created.length, items: created });
}
