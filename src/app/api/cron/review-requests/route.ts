import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail, reviewRequestEmail, type EmailLocale } from "@/lib/email";
import { isSuppressed } from "@/lib/automation/suppression";
import { reportServerError, logEvent } from "@/lib/error-report";

/**
 * Post-delivery review requests (Phase Y4).
 *
 * When an order reaches 'delivered' and has sat for at least DELAY_DAYS, email
 * the customer a one-tap review link prefilled with the car they bought
 * (car_id flows through to reviews.car_id → the per-car AggregateRating that
 * lights up ★ stars in search results). review_requested_at is the dedupe
 * stamp: once set, that order is never asked again.
 *
 * Fail-open per customer: a send failure leaves review_requested_at NULL so a
 * later run retries; a successful (or un-deliverable, no-email) order is stamped
 * so it drops out of the scan.
 */
const MAX_ORDERS = 50; // review requests sent per run
const DELAY_DAYS = 3; // wait this long after delivery before asking

function localeOf(v: unknown): EmailLocale {
  return v === "uz" || v === "en" ? v : "ru";
}

async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const supabase = createServiceClient();
    const cutoff = new Date(Date.now() - DELAY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Delivered orders that haven't been asked yet and were delivered (proxy:
    // last updated) at least DELAY_DAYS ago. The partial index (migration 027)
    // keeps this scan cheap.
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, reference_code, status, car_id, customer_name, customer_email, locale, updated_at, review_requested_at")
      .eq("status", "delivered")
      .is("review_requested_at", null)
      .lte("updated_at", cutoff)
      .order("updated_at", { ascending: true })
      .limit(MAX_ORDERS);

    if (error) {
      return NextResponse.json({ ok: false, error: "query failed" }, { status: 500 });
    }

    const rows = orders || [];
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, orders: 0, sent: 0 });
    }

    // Resolve car names for prefill in one batch.
    const carIds = Array.from(new Set(rows.map((o) => o.car_id).filter(Boolean) as string[]));
    const carById = new Map<string, { name: string; slug: string }>();
    if (carIds.length > 0) {
      const { data: cars } = await supabase
        .from("cars")
        .select("id, brand, model, year, slug")
        .in("id", carIds);
      for (const c of cars || []) {
        const name = `${c.brand} ${c.model}${c.year ? ` ${c.year}` : ""}`.trim();
        carById.set(c.id as string, { name, slug: c.slug as string });
      }
    }

    const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://tezmotors.uz").replace(/\/$/, "");
    let sent = 0;

    for (const order of rows) {
      const locale = localeOf(order.locale);
      const car = order.car_id ? carById.get(order.car_id) : undefined;

      // NPS-gated feedback link (Phase AW reputation loop): ask the rating first,
      // then promoters → public review, detractors → privately to the dealer.
      // car_id/car prefill the public-review path; ref ties a detractor's
      // private feedback to their order.
      const params = new URLSearchParams();
      if (order.car_id) params.set("car_id", order.car_id);
      if (car?.name) params.set("car", car.name);
      if (order.reference_code) params.set("ref", order.reference_code as string);
      const reviewUrl = `${base}/${locale}/feedback${params.toString() ? `?${params.toString()}` : ""}`;

      const hasEmail = !!order.customer_email;
      // Honor the marketing opt-out list even for this post-purchase ask.
      const suppressed = hasEmail ? await isSuppressed(supabase, order.customer_email as string, "email") : false;
      let delivered = false;

      if (hasEmail && !suppressed) {
        const tpl = reviewRequestEmail(locale, {
          name: order.customer_name || undefined,
          carName: car?.name,
          reviewUrl,
        });
        const { ok } = await sendEmail({ to: order.customer_email as string, subject: tpl.subject, html: tpl.html });
        delivered = delivered || ok;
      }

      // Stamp when we delivered, when there's no channel to reach them (no email),
      // or when they opted out — so the scan doesn't churn. A transient send
      // failure (has email, not suppressed, not ok) leaves it NULL to retry.
      if (delivered || !hasEmail || suppressed) {
        await supabase
          .from("orders")
          .update({ review_requested_at: new Date().toISOString() })
          .eq("id", order.id);
      }
      if (delivered) sent += 1;
    }

    logEvent("cron.review_requests", { orders: rows.length, sent });
    return NextResponse.json({ ok: true, orders: rows.length, sent });
  } catch (error) {
    reportServerError("GET /api/cron/review-requests", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
