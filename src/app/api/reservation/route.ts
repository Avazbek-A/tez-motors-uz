import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTelegramNotification } from "@/lib/telegram";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

const checkRateLimit = createRateLimiter({ max: 3, windowMs: 10 * 60 * 1000 });

const schema = z.object({
  car_id: z.string().uuid(),
  name: z.string().min(2).max(100),
  phone: z.string().min(5).max(20),
  amount_usd: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  turnstile_token: z.string().max(4096).optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!checkRateLimit(getClientIp(request))) {
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
      .update({ inventory_status: "reserved", is_available: false, updated_at: new Date().toISOString() })
      .eq("id", data.car_id)
      .eq("inventory_status", "available")
      .select("id")
      .single();

    if (updateError || !updatedCar) {
      return NextResponse.json({ success: false, error: "Car was reserved by someone else" }, { status: 409 });
    }

    const { error: inquiryError } = await supabase.from("inquiries").insert({
      type: "reservation",
      name: data.name,
      phone: data.phone,
      car_id: data.car_id,
      status: "new",
      source_page: "reservation-modal",
      message: `Reservation request for ${car.brand} ${car.model} ${car.year}${data.amount_usd ? `, deposit: $${data.amount_usd}` : ""}${data.notes ? `, notes: ${data.notes}` : ""}`,
      metadata: {
        amount_usd: data.amount_usd ?? null,
        notes: data.notes ?? null,
      },
    });

    if (inquiryError) {
      return NextResponse.json({ success: false, error: "Failed to save reservation" }, { status: 500 });
    }

    sendTelegramNotification({
      name: data.name,
      phone: data.phone,
      type: "reservation",
      message: data.notes ?? `Reservation request for ${car.brand} ${car.model} ${car.year}`,
      source_page: "reservation-modal",
    }).catch(() => {});

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
