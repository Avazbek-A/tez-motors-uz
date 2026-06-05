import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { enrollInJourneys } from "@/lib/automation/enroll";
import { logEvent, reportServerError } from "@/lib/error-report";

/**
 * Behavioral journey triggers (Phase AW Leap 2). Derives behavioral conditions
 * and enrolls contacts into the matching journeys. No-op for any condition the
 * dealer hasn't built an active journey for (enrollInJourneys returns 0). Hourly.
 *  - reservation_abandoned: reserved (status 'ordered') but no deposit, 2–72h old.
 *  - browsed_no_inquiry: a known contact viewed cars in the last 7d but never inquired.
 */
const CAP = 200;

async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const supabase = createServiceClient();
    const now = Date.now();
    let abandoned = 0;
    let browsed = 0;

    // 1) Abandoned reservation: reserved, unpaid, aged into the recovery window.
    const since = new Date(now - 72 * 3600 * 1000).toISOString();
    const until = new Date(now - 2 * 3600 * 1000).toISOString();
    const { data: orders } = await supabase
      .from("orders")
      .select("id, customer_phone, customer_name, locale, car_id, cars(brand, model, year)")
      .eq("status", "ordered")
      .gte("created_at", since)
      .lte("created_at", until)
      .limit(CAP);

    const orderIds = (orders || []).map((o) => o.id as string);
    const paid = new Set<string>();
    if (orderIds.length) {
      const { data: pays } = await supabase.from("payments").select("order_id").eq("state", 2).in("order_id", orderIds);
      for (const p of pays || []) paid.add(p.order_id as string);
    }
    for (const o of orders || []) {
      if (paid.has(o.id as string) || !o.customer_phone) continue;
      const rel = o.cars as { brand: string; model: string; year: number } | { brand: string; model: string; year: number }[] | null;
      const car = Array.isArray(rel) ? rel[0] : rel;
      const carName = car ? `${car.brand} ${car.model} ${car.year ?? ""}`.trim() : "";
      abandoned += await enrollInJourneys(supabase, "reservation_abandoned", {
        phone: o.customer_phone as string,
        name: (o.customer_name as string) || null,
        locale: (o.locale as string) || "ru",
        carId: (o.car_id as string) || null,
        context: carName ? { car: carName } : {},
      });
    }

    // 2) Browsed, no inquiry: known contacts (logged-in views) who looked but
    //    never asked. Anonymous views have no contact, so this is volume-light
    //    until more visitors are identified.
    const weekAgo = new Date(now - 7 * 86_400_000).toISOString();
    const { data: views } = await supabase
      .from("marketing_events")
      .select("contact_phone")
      .eq("type", "car_view")
      .not("contact_phone", "is", null)
      .gte("created_at", weekAgo)
      .limit(2000);
    const phones = Array.from(new Set((views || []).map((v) => v.contact_phone as string))).slice(0, CAP);
    if (phones.length) {
      const { data: recentInq } = await supabase.from("inquiries").select("phone").gte("created_at", weekAgo).in("phone", phones);
      const inquired = new Set((recentInq || []).map((i) => i.phone as string));
      for (const phone of phones) {
        if (inquired.has(phone)) continue;
        browsed += await enrollInJourneys(supabase, "browsed_no_inquiry", { phone, context: {} });
      }
    }

    logEvent("cron.behavioral_triggers", { abandoned, browsed });
    return NextResponse.json({ ok: true, abandoned, browsed });
  } catch (error) {
    reportServerError("GET /api/cron/behavioral-triggers", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
