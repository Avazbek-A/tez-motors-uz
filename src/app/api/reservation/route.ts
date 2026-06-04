import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyNewInquiry, confirmToCustomer } from "@/lib/notify";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import { verifyTurnstile } from "@/lib/turnstile";
import { parseAttributionCookie, ATTRIBUTION_COOKIE } from "@/lib/attribution";
import { reserveCarAndCreateOrder } from "@/lib/reservation";

const checkRateLimit = createKvRateLimiter({ max: 3, windowMs: 10 * 60 * 1000, prefix: "reservation" });

const schema = z.object({
  car_id: z.string().uuid(),
  name: z.string().min(2).max(100),
  phone: z.string().min(5).max(20),
  email: z.string().email().max(200).optional().or(z.literal("")),
  // String here because the form field is free text; we coerce to a number
  // below. Cap so it can't be used as a Telegram-message stuffing payload
  // (it's interpolated into the dealer notification).
  amount_usd: z.string().max(20).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  locale: z.enum(["ru", "uz", "en"]).optional(),
  turnstile_token: z.string().max(4096).optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!(await checkRateLimit(getClientIp(request)))) {
      return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const data = schema.parse(body);

    const ok = await verifyTurnstile(data.turnstile_token, getClientIp(request));
    if (!ok) {
      return NextResponse.json({ success: false, error: "Captcha verification failed" }, { status: 400 });
    }

    // First-touch acquisition attribution (cookie) → stamped on the order so
    // channel ROI can trace this deposit/sale back to its source (Phase AN).
    const attribution = parseAttributionCookie(request.cookies.get(ATTRIBUTION_COOKIE)?.value);

    const supabase = createServiceClient();

    const result = await reserveCarAndCreateOrder(supabase, {
      carId: data.car_id,
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      locale: data.locale,
      amountUsd: data.amount_usd ?? null,
      notes: data.notes ?? null,
      attribution,
      sourcePage: "reservation-modal",
    });

    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ success: false, error: "Car not found" }, { status: 404 });
      }
      if (result.reason === "unavailable") {
        return NextResponse.json({ success: false, error: "Car was reserved by someone else" }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: "Failed to save reservation" }, { status: 500 });
    }

    notifyNewInquiry({
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      type: "reservation",
      message: data.notes ?? `Reservation request for ${result.car.brand} ${result.car.model} ${result.car.year}`,
      source_page: "reservation-modal",
      locale: data.locale,
    }).catch(() => {});
    confirmToCustomer({ email: data.email || null, name: data.name, locale: data.locale }).catch(() => {});

    return NextResponse.json({ success: true, reference_code: result.referenceCode }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
