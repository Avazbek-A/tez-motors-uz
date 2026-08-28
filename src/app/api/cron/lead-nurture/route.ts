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
const STEP_HOURS = [48, 120, 336]; // 3-touch drip: step 1 @2d, step 2 @5d, step 3 @14d
const MAX_PER_RUN = 100;

async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const supabase = createServiceClient();
    const now = Date.now();
    const eligibleCutoff = new Date(now - STEP_HOURS[0] * 3600 * 1000).toISOString();

    const { data: leads, error } = await supabase
      .from("inquiries")
      .select("id, name, email, created_at, nurture_step")
      .eq("status", "new")
      .not("email", "is", null)
      .lt("nurture_step", 3)
      .lte("created_at", eligibleCutoff)
      .order("created_at", { ascending: true })
      .limit(MAX_PER_RUN);

    if (error) {
      return NextResponse.json({ ok: false, error: "query failed" }, { status: 500 });
    }

    let sent = 0;
    for (const lead of leads || []) {
      if (!lead.email) continue;
      const ageHours = (now - new Date(lead.created_at as string).getTime()) / 3_600_000;
      const dueStep = ageHours >= STEP_HOURS[2] ? 3 : ageHours >= STEP_HOURS[1] ? 2 : ageHours >= STEP_HOURS[0] ? 1 : 0;
      const current = (lead.nurture_step as number) ?? 0;
      if (dueStep <= current) continue;

      const tpl = leadNurtureEmail("ru", { name: (lead.name as string) || undefined, step: dueStep });
      const { ok } = await sendEmail({ to: lead.email as string, subject: tpl.subject, html: tpl.html });
      // Advance the step only on a successful send; a transient failure leaves
      // the step unchanged so the next run retries this drip touch instead of
      // silently skipping it. The per-run cap + lt(nurture_step,3) bound spend.
      if (ok) {
        await supabase
          .from("inquiries")
          .update({ nurture_step: dueStep, nurtured_at: new Date().toISOString() })
          .eq("id", lead.id);
        sent += 1;
      }
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
