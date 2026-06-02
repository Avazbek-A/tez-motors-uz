import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail, leadNurtureEmail } from "@/lib/email";
import { logEvent, reportServerError } from "@/lib/error-report";

/**
 * Cold-lead nurture — one automated, friendly follow-up for a lead that's been
 * sitting 'new' (unworked) for a while and left an email. Keeps the funnel warm
 * without the dealer chasing. Sent once per lead (nurtured_at dedupe stamp).
 *
 * Inquiries carry no locale column, so copy defaults to Russian (the primary
 * market); fail-open per lead; per-run cap bounds spend.
 */
const NURTURE_AFTER_HOURS = 48;
const MAX_PER_RUN = 100;

async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const supabase = createServiceClient();
    const cutoff = new Date(Date.now() - NURTURE_AFTER_HOURS * 3600 * 1000).toISOString();

    const { data: leads, error } = await supabase
      .from("inquiries")
      .select("id, name, email, status, created_at, nurtured_at")
      .eq("status", "new")
      .is("nurtured_at", null)
      .not("email", "is", null)
      .lte("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(MAX_PER_RUN);

    if (error) {
      return NextResponse.json({ ok: false, error: "query failed" }, { status: 500 });
    }

    let sent = 0;
    for (const lead of leads || []) {
      if (!lead.email) continue;
      const tpl = leadNurtureEmail("ru", { name: (lead.name as string) || undefined });
      const { ok } = await sendEmail({ to: lead.email as string, subject: tpl.subject, html: tpl.html });
      // Stamp regardless of send result so we don't reprocess the same lead every
      // run; a transient send failure simply means this lead isn't nurtured.
      await supabase
        .from("inquiries")
        .update({ nurtured_at: new Date().toISOString() })
        .eq("id", lead.id);
      if (ok) sent += 1;
    }

    logEvent("cron.lead_nurture", { candidates: (leads || []).length, sent });
    return NextResponse.json({ ok: true, candidates: (leads || []).length, sent });
  } catch (error) {
    reportServerError("GET /api/cron/lead-nurture", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
