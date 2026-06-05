import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { sendToCustomer } from "@/lib/customer-messaging";
import { advanceEnrollment, renderTemplate, type JourneyStep } from "@/lib/automation/journey";
import { isSuppressed, unsubscribeToken } from "@/lib/automation/suppression";
import { logEvent, reportServerError } from "@/lib/error-report";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://tezmotors.uz").replace(/\/$/, "");

/**
 * Marketing-automation runner (Phase AW). Fires due journey steps: for each
 * active enrollment whose next_run_at has passed, render the current step,
 * deliver via the omnichannel sendToCustomer, then advance (or complete).
 * Per-run cap bounds spend; each step is fail-open per enrollment. Hourly.
 */
const MAX_PER_RUN = 200;

async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const supabase = createServiceClient();
    const nowIso = new Date().toISOString();

    const { data: due } = await supabase
      .from("journey_enrollments")
      .select("id, journey_id, contact_phone, contact_name, contact_email, contact_locale, customer_id, car_id, current_step, context")
      .eq("status", "active")
      .lte("next_run_at", nowIso)
      .order("next_run_at", { ascending: true })
      .limit(MAX_PER_RUN);

    if (!due || due.length === 0) {
      logEvent("cron.journeys", { due: 0, sent: 0 });
      return NextResponse.json({ ok: true, due: 0, sent: 0 });
    }

    // Cache journeys for the batch (few distinct journeys, many enrollments).
    const journeyIds = Array.from(new Set(due.map((e) => e.journey_id as string)));
    const { data: journeys } = await supabase
      .from("automation_journeys")
      .select("id, status, steps")
      .in("id", journeyIds);
    const byId = new Map((journeys || []).map((j) => [j.id as string, j]));

    let sent = 0;
    for (const e of due) {
      const journey = byId.get(e.journey_id as string);
      // Journey paused/deleted since enrollment → exit the enrollment quietly.
      if (!journey || journey.status !== "active") {
        await supabase.from("journey_enrollments").update({ status: "exited" }).eq("id", e.id).then(() => {}, () => {});
        continue;
      }
      const steps = (journey.steps as JourneyStep[]) || [];
      const idx = e.current_step as number;
      const step = steps[idx];
      if (!step) {
        await supabase.from("journey_enrollments").update({ status: "completed", next_run_at: null }).eq("id", e.id).then(() => {}, () => {});
        continue;
      }

      // Optional car context for placeholders.
      // Honour the opt-out: a suppressed contact exits the journey, no send.
      const contactForSuppression = (e.contact_email as string) || (e.contact_phone as string);
      if (await isSuppressed(supabase, contactForSuppression, step.channel)) {
        await supabase.from("journey_enrollments").update({ status: "exited" }).eq("id", e.id).then(() => {}, () => {});
        continue;
      }

      const ctx = (e.context as Record<string, unknown>) || {};
      const vars: Record<string, string | number | null | undefined> = {
        name: (e.contact_name as string) || "",
        car: (ctx.car as string) || "",
        price: (ctx.price as string) || "",
        ref: (ctx.ref as string) || "",
      };
      const body = renderTemplate(step.body, vars);

      // One-click unsubscribe link for the email footer (compliance).
      const unsubContact = (e.contact_email as string) || (e.contact_phone as string);
      const unsubLoc = (e.contact_locale as string) || "ru";
      const unsubUrl = `${SITE}/${unsubLoc}/unsubscribe?c=${encodeURIComponent(unsubContact)}&t=${await unsubscribeToken(unsubContact)}`;
      const emailHtml = step.subject && e.contact_email
        ? `<p>${body}</p><hr/><p style="font-size:12px;color:#888">Не хотите получать эти сообщения? <a href="${unsubUrl}">Отписаться</a></p>`
        : null;

      const res = await sendToCustomer(
        supabase,
        {
          id: (e.customer_id as string) || null,
          phone: e.contact_phone as string,
          email: (e.contact_email as string) || null,
          locale: (e.contact_locale as string) || "ru",
          notify_channel: step.channel || "auto",
        },
        {
          title: "Tez Motors",
          body,
          url: step.url,
          buttonLabel: step.buttonLabel,
          email: emailHtml ? { subject: renderTemplate(step.subject!, vars), html: emailHtml } : null,
          kind: `journey:${e.journey_id}`,
        },
      );
      if (res.delivered) sent += 1;

      // Advance regardless of delivery — a dead channel shouldn't wedge the drip.
      const nextState = advanceEnrollment(idx, steps, Date.now());
      await supabase
        .from("journey_enrollments")
        .update({ current_step: nextState.current_step, status: nextState.status, next_run_at: nextState.next_run_at })
        .eq("id", e.id)
        .then(() => {}, () => {});
    }

    logEvent("cron.journeys", { due: due.length, sent });
    return NextResponse.json({ ok: true, due: due.length, sent });
  } catch (error) {
    reportServerError("GET /api/cron/journeys", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
