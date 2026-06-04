import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import { verifyTurnstile } from "@/lib/turnstile";
import { notifyNewInquiry, confirmToCustomer } from "@/lib/notify";

/**
 * Public service-booking intake (Phase AL). The services page was contact-only;
 * this captures a real booking (type + preferred date) into service_bookings,
 * alerts the dealer (Telegram + email) and confirms to the customer. Hardened
 * like every public POST: KV rate-limit + Turnstile + honeypot + zod.
 */
const checkRateLimit = createKvRateLimiter({ max: 4, windowMs: 10 * 60 * 1000, prefix: "service-booking" });

const SERVICE_TYPES = ["inspection", "diagnostics", "maintenance", "warranty", "other"] as const;

const schema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(5).max(20),
  service_type: z.enum(SERVICE_TYPES),
  preferred_date: z.string().max(10).optional().nullable(), // YYYY-MM-DD
  car_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  locale: z.enum(["ru", "uz", "en"]).optional(),
  email: z.string().email().max(200).optional().or(z.literal("")),
  website: z.string().max(0).optional(), // honeypot
  turnstile_token: z.string().max(4096).optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!(await checkRateLimit(getClientIp(request)))) {
      return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }
    const body = await request.json();
    const data = schema.parse(body);

    if (data.website) return NextResponse.json({ success: true }, { status: 201 }); // honeypot

    const ok = await verifyTurnstile(data.turnstile_token, getClientIp(request));
    if (!ok) {
      return NextResponse.json({ success: false, error: "Captcha verification failed" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const dateValid = data.preferred_date && /^\d{4}-\d{2}-\d{2}$/.test(data.preferred_date) ? data.preferred_date : null;

    const { error } = await supabase.from("service_bookings").insert({
      customer_name: data.name,
      customer_phone: data.phone,
      car_id: data.car_id ?? null,
      service_type: data.service_type,
      preferred_date: dateValid,
      notes: data.notes ?? null,
      locale: data.locale ?? "ru",
      status: "new",
    });
    if (error) {
      return NextResponse.json({ success: false, error: "Failed to save booking" }, { status: 500 });
    }

    const summary = `Service booking: ${data.service_type}${dateValid ? ` on ${dateValid}` : ""}${data.notes ? ` — ${data.notes}` : ""}`;
    notifyNewInquiry({
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      type: "service",
      message: summary,
      source_page: "service-booking",
      locale: data.locale,
    }).catch(() => {});
    confirmToCustomer({ email: data.email || null, name: data.name, locale: data.locale, type: "service" }).catch(() => {});

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
