import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { sendDealerDigest } from "@/lib/cron/dealer-digest";
import { reportServerError, logEvent } from "@/lib/error-report";

/**
 * Daily operations autopilot — the dealer's morning action queue.
 *
 * One briefing that turns scattered state into "here's your day": new leads,
 * open inquiries to work, unpaid reservations about to auto-release (call these
 * first), orders to advance, and parts to reorder. Read-only aggregation;
 * delivered via the shared dealer-digest channel (Telegram + email, fail-open).
 */
const ACTIVE_ORDER_STATUSES = ["sourcing", "in_transit", "at_customs", "ready_for_pickup"];
const OPEN_INQUIRY_STATUSES = ["new", "contacted", "in_progress"];

async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const supabase = createServiceClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [newLeads, openInquiries, unpaidReservations, activeOrders, partsRes] = await Promise.all([
      supabase.from("inquiries").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabase.from("inquiries").select("id", { count: "exact", head: true }).in("status", OPEN_INQUIRY_STATUSES),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "ordered")
        .is("released_at", null)
        .lte("created_at", since),
      supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ACTIVE_ORDER_STATUSES),
      supabase.from("parts").select("id, name_ru, stock_qty, min_order_qty").eq("is_published", true).limit(1000),
    ]);

    // Low stock = at or below the per-part reorder point (col-vs-col, in JS).
    const lowStock = (partsRes.data || []).filter(
      (p) => typeof p.stock_qty === "number" && typeof p.min_order_qty === "number" && p.stock_qty <= p.min_order_qty,
    );

    const counts = {
      newLeads: newLeads.count ?? 0,
      openInquiries: openInquiries.count ?? 0,
      unpaidReservations: unpaidReservations.count ?? 0,
      activeOrders: activeOrders.count ?? 0,
      lowStock: lowStock.length,
    };

    const lines = [
      `🆕 New leads (24h): ${counts.newLeads}`,
      `📋 Open inquiries to work: ${counts.openInquiries}`,
      `⏳ Unpaid reservations (>24h, call before auto-release): ${counts.unpaidReservations}`,
      `🚢 Orders in progress to advance: ${counts.activeOrders}`,
      `📦 Parts to reorder (at/below min): ${counts.lowStock}`,
    ];
    if (lowStock.length > 0) {
      const top = lowStock
        .slice(0, 5)
        .map((p) => `   • ${p.name_ru} (${p.stock_qty}/${p.min_order_qty})`)
        .join("\n");
      lines.push("Low-stock parts:", top);
    }

    await sendDealerDigest("Daily operations — Tez Motors", lines);
    logEvent("cron.ops_digest", counts);
    return NextResponse.json({ ok: true, ...counts });
  } catch (error) {
    reportServerError("GET /api/cron/ops-digest", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
