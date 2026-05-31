import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyNewInquiry, confirmToCustomer } from "@/lib/notify";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import { verifyTurnstile } from "@/lib/turnstile";
import { generateReferenceCode } from "@/lib/order-code";

const checkRateLimit = createKvRateLimiter({ max: 3, windowMs: 10 * 60 * 1000, prefix: "reservation" });

const schema = z.object({
  car_id: z.string().uuid(),
  name: z.string().min(2).max(100),
  phone: z.string().min(5).max(20),
  email: z.string().email().max(200).optional().or(z.literal("")),
  amount_usd: z.string().optional().nullable(),
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

    const supabase = createServiceClient();

    const { data: car, error: carError } = await supabase
      .from("cars")
      .select("id, brand, model, year, inventory_status")
      .eq("id", data.car_id)
      .single();

    if (carError || !car) {
      return NextResponse.json({ success: false, error: "Car not found" }, { status: 404 });
    }

    if (car.inventory_status !== "available") {
      return NextResponse.json({ success: false, error: "Car is not available" }, { status: 409 });
    }

    const { error: updateError, data: updatedCar } = await supabase
      .from("cars")
      .update({ inventory_status: "reserved", updated_at: new Date().toISOString() })
      .eq("id", data.car_id)
      .eq("inventory_status", "available")
      .select("id")
      .single();

    if (updateError || !updatedCar) {
      return NextResponse.json({ success: false, error: "Car was reserved by someone else" }, { status: 409 });
    }

    const { data: inquiry, error: inquiryError } = await supabase
      .from("inquiries")
      .insert({
        type: "reservation",
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        car_id: data.car_id,
        status: "new",
        source_page: "reservation-modal",
        message: `Reservation request for ${car.brand} ${car.model} ${car.year}${data.amount_usd ? `, deposit: $${data.amount_usd}` : ""}${data.notes ? `, notes: ${data.notes}` : ""}`,
        metadata: {
          amount_usd: data.amount_usd ?? null,
          notes: data.notes ?? null,
        },
      })
      .select("id")
      .single();

    if (inquiryError || !inquiry) {
      return NextResponse.json({ success: false, error: "Failed to save reservation" }, { status: 500 });
    }

    // Turn the reservation into a trackable import order. The reference code is
    // what the customer uses on /track (with their phone). Retry once on the
    // (vanishingly unlikely) UNIQUE collision before giving up on the order;
    // the reservation itself is already saved, so we never fail the request.
    let referenceCode: string | null = null;
    for (let attempt = 0; attempt < 2 && !referenceCode; attempt++) {
      const code = generateReferenceCode();
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          reference_code: code,
          status: "ordered",
          car_id: data.car_id,
          inquiry_id: inquiry.id,
          customer_name: data.name,
          customer_phone: data.phone,
          customer_email: data.email || null,
          locale: data.locale ?? "ru",
          amount_usd: data.amount_usd ? Number(data.amount_usd) || null : null,
          notes: data.notes ?? null,
        })
        .select("id")
        .single();

      if (!orderError && order) {
        referenceCode = code;
        await supabase.from("order_events").insert({
          order_id: order.id,
          status: "ordered",
          note: "Reservation received",
        });
      }
    }

    notifyNewInquiry({
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      type: "reservation",
      message: data.notes ?? `Reservation request for ${car.brand} ${car.model} ${car.year}`,
      source_page: "reservation-modal",
      locale: data.locale,
    }).catch(() => {});
    confirmToCustomer({ email: data.email || null, name: data.name, locale: data.locale }).catch(() => {});

    return NextResponse.json({ success: true, reference_code: referenceCode }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
