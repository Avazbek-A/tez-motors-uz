import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { sendDealerDigest } from "@/lib/cron/dealer-digest";
import { reportServerError, logEvent } from "@/lib/error-report";
import { milestoneLabel } from "@/lib/shipment-flow";

/**
 * Shipment SLA watchdog: flag in-flight shipments whose ETA has passed but
 * aren't delivered yet, so the dealer chases the supplier/broker. One digest.
 */
async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("shipments")
      .select("title, supplier, status, eta_date")
      .neq("status", "delivered")
      .not("eta_date", "is", null)
      .lt("eta_date", today)
      .order("eta_date", { ascending: true })
      .limit(50);
    if (error) return NextResponse.json({ ok: false, error: "query failed" }, { status: 500 });

    const rows = data || [];
    if (rows.length > 0) {
      const lines = rows.map((r) => `• ETA ${r.eta_date} — ${r.title} (${r.supplier || "?"}) · stuck at ${milestoneLabel(r.status)}`);
      await sendDealerDigest(`Overdue shipments (${rows.length}) — Tez Motors`, lines);
    }

    logEvent("cron.shipment_sla", { overdue: rows.length });
    return NextResponse.json({ ok: true, overdue: rows.length });
  } catch (error) {
    reportServerError("GET /api/cron/shipment-sla", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
