import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { alertDealer, logEvent, reportServerError } from "@/lib/error-report";
import { agingSuggestion, STALE_AFTER_DAYS } from "@/lib/inventory-aging";

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
    const cutoff = new Date(now - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Only available cars old enough to be candidates.
    const { data: cars, error } = await supabase
      .from("cars")
      .select("id, brand, model, year, price_usd, created_at")
      .eq("inventory_status", "available")
      .lte("created_at", cutoff)
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

    const flagged = rows
      .map((c) => {
        const id = c.id as string;
        const demandScore = (inq.get(id) || 0) * 5 + (watch.get(id) || 0) * 3 + (fav.get(id) || 0);
        const daysOnLot = Math.floor((now - new Date(c.created_at as string).getTime()) / 86_400_000);
        const price = typeof c.price_usd === "number" ? c.price_usd : Number(c.price_usd) || 0;
        const s = agingSuggestion({ price_usd: price, daysOnLot, demandScore });
        return { brand: c.brand, model: c.model, year: c.year, price, daysOnLot, demandScore, ...s };
      })
      .filter((c) => c.markdownPct > 0)
      .sort((a, b) => b.daysOnLot - a.daysOnLot);

    if (flagged.length > 0) {
      const lines = ["These cars are aging with weak demand — consider a markdown:"];
      for (const c of flagged.slice(0, 20)) {
        lines.push(
          `• ${c.brand} ${c.model}${c.year ? ` ${c.year}` : ""} — ${c.daysOnLot}d, demand ${c.demandScore} → -${c.markdownPct}% ($${c.price.toLocaleString("en-US")} → $${c.suggestedPriceUsd.toLocaleString("en-US")})`,
        );
      }
      if (flagged.length > 20) lines.push(`…and ${flagged.length - 20} more.`);
      alertDealer("Aged inventory — consider markdowns — Tez Motors", lines, { key: "inventory_aging" }).catch(() => {});
    }

    logEvent("cron.inventory_aging", { scanned: rows.length, flagged: flagged.length });
    return NextResponse.json({ ok: true, scanned: rows.length, flagged: flagged.length });
  } catch (error) {
    reportServerError("GET /api/cron/inventory-aging", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
