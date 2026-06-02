import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { sendDealerDigest } from "@/lib/cron/dealer-digest";
import { reportServerError, logEvent } from "@/lib/error-report";

/**
 * Daily "yesterday in numbers" summary for the dealer: new leads in the last
 * 24h and orders whose status advanced. Read-only aggregation.
 */
async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const supabase = createServiceClient();

    const [{ count: leadCount }, { count: orderEventCount }, { count: orderCount }] = await Promise.all([
      supabase.from("inquiries").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabase.from("order_events").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", since),
    ]);

    const lines = [
      `🆕 New leads (24h): ${leadCount ?? 0}`,
      `📦 New orders (24h): ${orderCount ?? 0}`,
      `🔁 Order updates (24h): ${orderEventCount ?? 0}`,
    ];
    await sendDealerDigest("Daily summary — Tez Motors", lines);

    logEvent("cron.lead_digest", {
      leads: leadCount ?? 0,
      orders: orderCount ?? 0,
      order_events: orderEventCount ?? 0,
    });
    return NextResponse.json({
      ok: true,
      leads: leadCount ?? 0,
      orders: orderCount ?? 0,
      order_events: orderEventCount ?? 0,
    });
  } catch (error) {
    reportServerError("GET /api/cron/lead-digest", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
