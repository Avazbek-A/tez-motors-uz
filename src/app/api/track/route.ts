import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import { normalizeReferenceCode } from "@/lib/order-code";

// Order lookup is service-role (orders/order_events are RLS-locked, no anon
// read) and gated on reference_code + phone so an unauthenticated caller can
// never enumerate orders by code alone. Rate-limited (KV-backed so the cap is
// shared across Workers isolates) to blunt brute-forcing the phone for a code.
const checkRateLimit = createKvRateLimiter({ max: 10, windowMs: 5 * 60 * 1000, prefix: "track" });

import { loosePhone as normalizePhone } from "@/lib/phone";

export async function GET(request: NextRequest) {
  try {
    if (!(await checkRateLimit(getClientIp(request)))) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const codeRaw = request.nextUrl.searchParams.get("code");
    const phoneRaw = request.nextUrl.searchParams.get("phone");

    if (!codeRaw || !phoneRaw || phoneRaw.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: "Reference code and phone number are required" },
        { status: 400 },
      );
    }

    const code = normalizeReferenceCode(codeRaw);
    const phone = normalizePhone(phoneRaw);

    const supabase = createServiceClient();

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, reference_code, status, customer_name, customer_phone, amount_usd, notes, created_at, updated_at, car_id",
      )
      .eq("reference_code", code)
      .single();

    // Constant-ish response: never reveal whether the code exists vs the phone
    // mismatched — both return the same "not found" shape.
    if (error || !order || normalizePhone(order.customer_phone) !== phone) {
      return NextResponse.json({ success: true, order: null });
    }

    let car: { brand: string; model: string; year: number; slug: string } | null = null;
    if (order.car_id) {
      const { data: carRow } = await supabase
        .from("cars")
        .select("brand, model, year, slug")
        .eq("id", order.car_id)
        .single();
      car = carRow ?? null;
    }

    const { data: events } = await supabase
      .from("order_events")
      .select("status, note, created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      success: true,
      order: {
        reference_code: order.reference_code,
        status: order.status,
        customer_name: order.customer_name,
        amount_usd: order.amount_usd,
        notes: order.notes,
        created_at: order.created_at,
        updated_at: order.updated_at,
        car,
        events: events ?? [],
      },
    });
  } catch (error) {
    console.error("Track API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
