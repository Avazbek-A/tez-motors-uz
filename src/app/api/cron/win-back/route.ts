import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail, winBackEmail, type EmailLocale } from "@/lib/email";
import { isSuppressed } from "@/lib/automation/suppression";
import { logEvent, reportServerError } from "@/lib/error-report";

/**
 * Dormant-customer win-back. ~A year after delivery, email a past buyer a single
 * re-engagement message (repeat purchase / trade-in / referral). winback_sent_at
 * dedupes; fail-open; per-run cap.
 */
const WINBACK_AFTER_DAYS = 365;
const MAX_PER_RUN = 50;

function localeOf(v: unknown): EmailLocale {
  return v === "uz" || v === "en" ? v : "ru";
}

async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const supabase = createServiceClient();
    const cutoff = new Date(Date.now() - WINBACK_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, customer_name, customer_email, locale, updated_at, status, winback_sent_at")
      .eq("status", "delivered")
      .is("winback_sent_at", null)
      .lte("updated_at", cutoff)
      .order("updated_at", { ascending: true })
      .limit(MAX_PER_RUN);

    if (error) return NextResponse.json({ ok: false, error: "query failed" }, { status: 500 });

    let sent = 0;
    for (const o of orders || []) {
      const locale = localeOf(o.locale);
      // Stamp permanently for suppressed (opt-out) and no-email orders so we don't
      // reconsider them; on a real send, stamp only on success so a transient mail
      // failure retries next run instead of silently dropping the message.
      let stamp = true;
      if (o.customer_email) {
        const email = o.customer_email as string;
        if (await isSuppressed(supabase, email, "email")) {
          // Win-back is a marketing re-engagement send — honor the opt-out list.
        } else {
          const tpl = winBackEmail(locale, { name: o.customer_name || undefined });
          const { ok } = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
          if (ok) sent += 1;
          else stamp = false;
        }
      }
      if (stamp) {
        await supabase.from("orders").update({ winback_sent_at: new Date().toISOString() }).eq("id", o.id);
      }
    }

    logEvent("cron.win_back", { orders: (orders || []).length, sent });
    return NextResponse.json({ ok: true, orders: (orders || []).length, sent });
  } catch (error) {
    reportServerError("GET /api/cron/win-back", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
