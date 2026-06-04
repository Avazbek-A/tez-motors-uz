import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { alertDealer, logEvent } from "@/lib/error-report";
import { resolveAutopilot, markdownAllowed, AUTOPILOT_ROW_ID } from "@/lib/autopilot";
import { agingSuggestion } from "@/lib/inventory-aging";
import { applyCarMarkdown, type CarRow } from "@/lib/copilot/actions";

/**
 * Autopilot — auto-markdown aged stock (Phase AH). Opt-in (master + flag), capped
 * per run, NEVER below cost + a margin floor. Reuses the Dealer Copilot's audited
 * applyCarMarkdown op (so it notifies watchers + logs). Fired by the cron worker.
 */
export async function POST(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  const supabase = createServiceClient();
  const { data: cfgRow } = await supabase.from("site_settings").select("values").eq("id", AUTOPILOT_ROW_ID).maybeSingle();
  const cfg = resolveAutopilot(cfgRow?.values);
  if (!markdownAllowed(cfg)) return NextResponse.json({ ok: true, skipped: "disabled" });

  const now = Date.now();
  const thirtyAgo = new Date(now - 30 * 86_400_000).toISOString();
  const [carsRes, costsRes, inqRes] = await Promise.all([
    supabase.from("cars").select("id, slug, brand, model, year, price_usd, original_price_usd, inventory_status, created_at").eq("inventory_status", "available").limit(2000),
    supabase.from("car_costs").select("car_id, cost_usd").limit(2000),
    supabase.from("inquiries").select("car_id").not("car_id", "is", null).gte("created_at", thirtyAgo).limit(5000),
  ]);
  const costBy = new Map<string, number>();
  for (const c of costsRes.data || []) costBy.set(c.car_id, Number(c.cost_usd) || 0);
  const demand = new Map<string, number>();
  for (const i of inqRes.data || []) demand.set(i.car_id as string, (demand.get(i.car_id as string) || 0) + 1);

  const candidates = (carsRes.data || [])
    .map((c) => {
      const daysOnLot = Math.floor((now - new Date(c.created_at).getTime()) / 86_400_000);
      const demandScore = (demand.get(c.id) || 0) * 5;
      const s = agingSuggestion({ price_usd: Number(c.price_usd) || 0, daysOnLot, demandScore });
      return { c, daysOnLot, markdownPct: s.markdownPct, suggestedPriceUsd: s.suggestedPriceUsd };
    })
    .filter((x) => x.daysOnLot >= cfg.autoMarkdown.minDaysOnLot && x.markdownPct > 0)
    // Margin floor: skip if it would sell below cost + minMarginPct (when cost known).
    .filter((x) => {
      const cost = costBy.get(x.c.id);
      return cost == null || cost === 0 || x.suggestedPriceUsd >= cost * (1 + cfg.autoMarkdown.minMarginPct / 100);
    })
    .sort((a, b) => b.daysOnLot - a.daysOnLot)
    .slice(0, cfg.autoMarkdown.maxPerRun);

  const applied: string[] = [];
  for (const x of candidates) {
    const res = await applyCarMarkdown(supabase, x.c as CarRow, x.suggestedPriceUsd);
    if (res.ok) applied.push(`${x.c.brand} ${x.c.model} → $${x.suggestedPriceUsd.toLocaleString("en-US")} (−${x.markdownPct}%, ${x.daysOnLot}д)`);
  }
  if (applied.length) await alertDealer(`🤖 Автопилот уценил ${applied.length} авто`, [...applied, "Отключить: Настройки → Автопилот."], { key: "auto-markdown" });
  logEvent("autopilot.markdown", { applied: applied.length });
  return NextResponse.json({ ok: true, applied: applied.length, items: applied });
}
