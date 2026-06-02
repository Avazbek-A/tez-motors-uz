import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { alertDealer, logEvent, reportServerError } from "@/lib/error-report";

/**
 * Order SLA watchdog — keeps the fulfillment pipeline moving without the dealer
 * having to remember. Flags orders that have sat in an active status longer
 * than expected and alerts the dealer (throttled) to advance or update them.
 *
 * Unpaid 'ordered' reservations are owned by reservation-recovery, so they're
 * excluded here. Read-only; uses order.updated_at as the last-activity proxy.
 */
const SLA_DAYS: Record<string, number> = {
  deposit_paid: 5,
  sourcing: 21,
  in_transit: 45,
  at_customs: 14,
  ready_for_pickup: 7,
};
const MAX = 200;

async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const supabase = createServiceClient();
    const { data: orders, error } = await supabase
      .from("orders")
      .select("reference_code, status, updated_at, customer_name")
      .in("status", Object.keys(SLA_DAYS))
      .is("released_at", null)
      .order("updated_at", { ascending: true })
      .limit(MAX);

    if (error) {
      return NextResponse.json({ ok: false, error: "query failed" }, { status: 500 });
    }

    const now = Date.now();
    const stuck = (orders || [])
      .map((o) => ({
        ...o,
        ageDays: Math.floor((now - new Date(o.updated_at as string).getTime()) / 86_400_000),
      }))
      .filter((o) => o.ageDays >= (SLA_DAYS[o.status] ?? Infinity));

    if (stuck.length > 0) {
      const lines = ["These orders have been in their status longer than expected — advance or update them:"];
      for (const o of stuck.slice(0, 20)) {
        lines.push(`• ${o.reference_code} — ${o.status} (${o.ageDays}d) — ${o.customer_name}`);
      }
      if (stuck.length > 20) lines.push(`…and ${stuck.length - 20} more.`);
      alertDealer("Orders need attention — Tez Motors", lines, { key: "order_sla" }).catch(() => {});
    }

    logEvent("cron.order_sla", { scanned: (orders || []).length, stuck: stuck.length });
    return NextResponse.json({ ok: true, scanned: (orders || []).length, stuck: stuck.length });
  } catch (error) {
    reportServerError("GET /api/cron/order-sla", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
