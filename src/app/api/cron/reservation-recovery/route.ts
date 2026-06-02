import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import {
  sendEmail,
  reservationReminderEmail,
  reservationReleasedEmail,
  type EmailLocale,
} from "@/lib/email";
import { reportServerError, logEvent, alertDealer } from "@/lib/error-report";

/**
 * Abandoned-reservation recovery.
 *
 * A stock reservation flips a car to 'reserved' and opens an order at 'ordered'
 * (unpaid; it only advances to 'deposit_paid' once a payment performs). Left
 * alone, an unpaid reservation locks the car out of inventory forever and the
 * sale dies in silence.
 *
 * This sweep, per unpaid + not-yet-released order:
 *   - after REMINDER_AFTER_HOURS: email the customer a one-tap deposit link
 *     (once — guarded by reminder_sent_at);
 *   - after RELEASE_AFTER_HOURS: auto-release — revert the car to 'available'
 *     (only if it's still 'reserved'), stamp released_at, append an order_event,
 *     and email the customer that the hold expired.
 *
 * Fail-open and bounded: a per-run cap limits blast radius, every external call
 * is best-effort, and released_at / reminder_sent_at are the dedupe stamps so a
 * looping run can't double-act or storm anyone.
 */
const REMINDER_AFTER_HOURS = 6; // nudge once the reservation has sat this long unpaid
const RELEASE_AFTER_HOURS = 48; // auto-release the car if still unpaid after this
const MAX_PER_RUN = 100;

function localeOf(v: unknown): EmailLocale {
  return v === "uz" || v === "en" ? v : "ru";
}

async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const supabase = createServiceClient();
    const now = Date.now();
    const reminderCutoff = new Date(now - REMINDER_AFTER_HOURS * 3600 * 1000).toISOString();
    const releaseCutoff = new Date(now - RELEASE_AFTER_HOURS * 3600 * 1000).toISOString();
    const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://tezmotors.uz").replace(/\/$/, "");

    // Unpaid, un-released reservations old enough to act on. The partial index
    // (migration 028) keeps this scan cheap. Oldest first so release-due ones
    // are never starved by newer arrivals under the cap.
    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        "id, reference_code, status, car_id, customer_name, customer_email, locale, created_at, reminder_sent_at, released_at",
      )
      .eq("status", "ordered")
      .is("released_at", null)
      .lte("created_at", reminderCutoff)
      .order("created_at", { ascending: true })
      .limit(MAX_PER_RUN);

    if (error) {
      return NextResponse.json({ ok: false, error: "query failed" }, { status: 500 });
    }

    const rows = orders || [];
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, scanned: 0, reminded: 0, released: 0 });
    }

    // Resolve car names for the customer-facing copy in one batch.
    const carIds = Array.from(new Set(rows.map((o) => o.car_id).filter(Boolean) as string[]));
    const carById = new Map<string, string>();
    if (carIds.length > 0) {
      const { data: cars } = await supabase
        .from("cars")
        .select("id, brand, model, year")
        .in("id", carIds);
      for (const c of cars || []) {
        carById.set(c.id as string, `${c.brand} ${c.model}${c.year ? ` ${c.year}` : ""}`.trim());
      }
    }

    const fallbackName = { ru: "автомобиль", uz: "avtomobil", en: "the car" } as const;
    let reminded = 0;
    let released = 0;

    for (const o of rows) {
      const locale = localeOf(o.locale);
      const carName = (o.car_id && carById.get(o.car_id)) || fallbackName[locale];
      const releaseDue = o.created_at <= releaseCutoff;

      if (releaseDue) {
        // Revert the car only if it's still the reserved unit we locked — never
        // clobber a car the dealer manually moved to sold/available since.
        if (o.car_id) {
          await supabase
            .from("cars")
            .update({ inventory_status: "available", updated_at: new Date().toISOString() })
            .eq("id", o.car_id)
            .eq("inventory_status", "reserved");
        }
        await supabase
          .from("orders")
          .update({ released_at: new Date().toISOString() })
          .eq("id", o.id);
        await supabase.from("order_events").insert({
          order_id: o.id,
          status: "ordered",
          note: "Reservation expired — deposit not paid; car released back to inventory.",
        });
        if (o.customer_email) {
          const tpl = reservationReleasedEmail(locale, {
            name: o.customer_name || undefined,
            carName,
          });
          await sendEmail({ to: o.customer_email as string, subject: tpl.subject, html: tpl.html });
        }
        released += 1;
        continue;
      }

      // Reminder window (between REMINDER and RELEASE): nudge once.
      if (!o.reminder_sent_at && o.customer_email) {
        const trackUrl = `${site}/${locale}/track?code=${encodeURIComponent(o.reference_code)}`;
        const tpl = reservationReminderEmail(locale, {
          name: o.customer_name || undefined,
          carName,
          trackUrl,
          hoursLeft: RELEASE_AFTER_HOURS - REMINDER_AFTER_HOURS,
        });
        const { ok } = await sendEmail({
          to: o.customer_email as string,
          subject: tpl.subject,
          html: tpl.html,
        });
        if (ok) {
          await supabase
            .from("orders")
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("id", o.id);
          reminded += 1;
        }
      }
    }

    // One throttled heads-up to the dealer when inventory was freed.
    if (released > 0) {
      alertDealer(
        "Reservations auto-released — Tez Motors",
        [`${released} unpaid reservation(s) expired; their cars are back in inventory.`],
        { key: "reservation_recovery" },
      ).catch(() => {});
    }

    logEvent("cron.reservation_recovery", { scanned: rows.length, reminded, released });
    return NextResponse.json({ ok: true, scanned: rows.length, reminded, released });
  } catch (error) {
    reportServerError("GET /api/cron/reservation-recovery", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
