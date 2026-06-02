import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail, serviceReminderEmail, type EmailLocale } from "@/lib/email";
import { logEvent, reportServerError } from "@/lib/error-report";

/**
 * Post-delivery service / maintenance reminder + parts cross-sell. A while after
 * an order is delivered, email the owner a one-time reminder. service_reminded_at
 * is the dedupe stamp; fail-open; per-run cap.
 */
const SERVICE_AFTER_DAYS = 150; // ~5 months after delivery
const MAX_PER_RUN = 50;

function localeOf(v: unknown): EmailLocale {
  return v === "uz" || v === "en" ? v : "ru";
}

async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const supabase = createServiceClient();
    const cutoff = new Date(Date.now() - SERVICE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, customer_name, customer_email, locale, car_id, updated_at, service_reminded_at, status")
      .eq("status", "delivered")
      .is("service_reminded_at", null)
      .lte("updated_at", cutoff)
      .order("updated_at", { ascending: true })
      .limit(MAX_PER_RUN);

    if (error) return NextResponse.json({ ok: false, error: "query failed" }, { status: 500 });

    const rows = orders || [];
    const carIds = Array.from(new Set(rows.map((o) => o.car_id).filter(Boolean) as string[]));
    const carById = new Map<string, string>();
    if (carIds.length > 0) {
      const { data: cars } = await supabase.from("cars").select("id, brand, model, year").in("id", carIds);
      for (const c of cars || []) carById.set(c.id as string, `${c.brand} ${c.model}${c.year ? ` ${c.year}` : ""}`.trim());
    }

    let sent = 0;
    for (const o of rows) {
      const locale = localeOf(o.locale);
      const carName = o.car_id ? carById.get(o.car_id) : undefined;
      if (o.customer_email) {
        const tpl = serviceReminderEmail(locale, { name: o.customer_name || undefined, carName });
        const { ok } = await sendEmail({ to: o.customer_email as string, subject: tpl.subject, html: tpl.html });
        if (ok) sent += 1;
      }
      // Stamp regardless so the scan doesn't churn on the same order.
      await supabase.from("orders").update({ service_reminded_at: new Date().toISOString() }).eq("id", o.id);
    }

    logEvent("cron.service_reminders", { orders: rows.length, sent });
    return NextResponse.json({ ok: true, orders: rows.length, sent });
  } catch (error) {
    reportServerError("GET /api/cron/service-reminders", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
