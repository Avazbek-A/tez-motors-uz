import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { sendDealerDigest } from "@/lib/cron/dealer-digest";
import { reportServerError, logEvent } from "@/lib/error-report";

/**
 * Remind the dealer about CRM follow-ups due today or overdue. Reads inquiries
 * with a follow_up_date <= today that aren't closed, and sends one digest.
 */
async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const supabase = createServiceClient();

    const { data: due, error } = await supabase
      .from("inquiries")
      .select("name, phone, type, status, follow_up_date")
      .not("follow_up_date", "is", null)
      .lte("follow_up_date", today)
      .neq("status", "closed")
      .order("follow_up_date", { ascending: true })
      .limit(50);

    if (error) {
      return NextResponse.json({ ok: false, error: "query failed" }, { status: 500 });
    }

    const rows = due || [];
    if (rows.length > 0) {
      const lines = rows.map(
        (r) =>
          `• ${r.follow_up_date} — ${r.name} (${r.phone}) · ${r.type} · ${r.status}`,
      );
      await sendDealerDigest(`Follow-ups due (${rows.length}) — Tez Motors`, lines);
    }

    logEvent("cron.follow_ups", { due: rows.length });
    return NextResponse.json({ ok: true, due: rows.length });
  } catch (error) {
    reportServerError("GET /api/cron/follow-ups", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
