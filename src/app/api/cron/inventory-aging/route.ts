import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { alertDealer, logEvent, reportServerError } from "@/lib/error-report";
import { agingSuggestion, suggestIncreasePct, increasePrice } from "@/lib/inventory-aging";

/**
 * Aged-inventory autopilot. Finds available cars that have sat on the lot past
 * the stale threshold with weak demand and alerts the dealer with suggested
 * markdowns (computed by the pure aging engine). Detection + suggestion only —
 * it never changes a price itself; the dealer applies the markdown.
 *
 * Demand score mirrors the demand board: inquiry ×5 > watch ×3 > favorite ×1.
 */
const MAX_SCAN = 2000;

async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const supabase = createServiceClient();
    const now = Date.now();

    // All available cars — the engine decides per car whether to suggest a
    // markdown (old + cold) or an increase (fresh + hot), or leave it.
    const { data: cars, error } = await supabase
      .from("cars")
      .select("id, brand, model, year, price_usd, created_at")
      .eq("inventory_status", "available")
      .limit(MAX_SCAN);

    if (error) {
      return NextResponse.json({ ok: false, error: "query failed" }, { status: 500 });
    }

    const rows = cars || [];
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, scanned: 0, flagged: 0 });
    }

    const ids = rows.map((c) => c.id as string);
    const [favRes, watchRes, inqRes] = await Promise.all([
      supabase.from("favorites").select("car_id").in("car_id", ids).limit(MAX_SCAN * 5),
      supabase.from("price_watches").select("car_id").is("notified_at", null).in("car_id", ids).limit(MAX_SCAN * 5),
      supabase.from("inquiries").select("car_id").in("car_id", ids).limit(MAX_SCAN * 5),
    ]);

    const count = (rowsIn: { car_id: unknown }[] | null) => {
      const m = new Map<string, number>();
      for (const r of rowsIn || []) {
        const id = r.car_id as string;
        if (id) m.set(id, (m.get(id) || 0) + 1);
      }
      return m;
    };
    const fav = count(favRes.data);
    const watch = count(watchRes.data);
    const inq = count(inqRes.data);

    const scored = rows.map((c) => {
      const id = c.id as string;
      const demandScore = (inq.get(id) || 0) * 5 + (watch.get(id) || 0) * 3 + (fav.get(id) || 0);
      const daysOnLot = Math.floor((now - new Date(c.created_at as string).getTime()) / 86_400_000);
      const price = typeof c.price_usd === "number" ? c.price_usd : Number(c.price_usd) || 0;
      const down = agingSuggestion({ price_usd: price, daysOnLot, demandScore });
      const upPct = suggestIncreasePct(daysOnLot, demandScore);
      const name = `${c.brand} ${c.model}${c.year ? ` ${c.year}` : ""}`;
      return { name, price, daysOnLot, demandScore, down, upPct, upPrice: upPct > 0 ? increasePrice(price, upPct) : price };
    });

    const markdowns = scored.filter((c) => c.down.markdownPct > 0).sort((a, b) => b.daysOnLot - a.daysOnLot);
    const increases = scored.filter((c) => c.upPct > 0).sort((a, b) => b.demandScore - a.demandScore);

    if (markdowns.length > 0 || increases.length > 0) {
      const lines: string[] = [];
      if (markdowns.length > 0) {
        lines.push("⬇ Aging + weak demand — consider a markdown:");
        for (const c of markdowns.slice(0, 15)) {
          lines.push(`• ${c.name} — ${c.daysOnLot}d, demand ${c.demandScore} → -${c.down.markdownPct}% ($${c.price.toLocaleString("en-US")} → $${c.down.suggestedPriceUsd.toLocaleString("en-US")})`);
        }
        if (markdowns.length > 15) lines.push(`…and ${markdowns.length - 15} more.`);
      }
      if (increases.length > 0) {
        lines.push("⬆ Fresh + strong demand — you could raise the price:");
        for (const c of increases.slice(0, 10)) {
          lines.push(`• ${c.name} — ${c.daysOnLot}d, demand ${c.demandScore} → +${c.upPct}% ($${c.price.toLocaleString("en-US")} → $${c.upPrice.toLocaleString("en-US")})`);
        }
      }
      alertDealer("Dynamic repricing suggestions — Tez Motors", lines, { key: "inventory_aging" }).catch(() => {});
    }

    logEvent("cron.inventory_aging", { scanned: rows.length, markdowns: markdowns.length, increases: increases.length });
    return NextResponse.json({ ok: true, scanned: rows.length, markdowns: markdowns.length, increases: increases.length });
  } catch (error) {
    reportServerError("GET /api/cron/inventory-aging", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
