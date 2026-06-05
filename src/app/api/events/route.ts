import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import { getCustomerContext } from "@/lib/customer-auth";
import { recordEvent } from "@/lib/automation/events";

/**
 * Behavioral event beacon (Phase AW Leap 2). The client beacons low-value
 * behavioral signals (car views) here; we attach the contact when a customer
 * session is present (so browsed-no-inquiry journeys can reach them). Anonymous
 * events are still logged (car_id only) for aggregate insight. Rate-limited,
 * fail-open — never errors.
 */
const checkRateLimit = createKvRateLimiter({ max: 60, windowMs: 60 * 1000, prefix: "events" });

const schema = z.object({
  type: z.enum(["car_view", "favorite"]),
  car_id: z.string().uuid().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    if (!(await checkRateLimit(getClientIp(request)))) return NextResponse.json({ ok: true });
    const data = schema.parse(await request.json());

    const supabase = createServiceClient();
    let customerId: string | null = null;
    let phone: string | null = null;
    try {
      const ctx = await getCustomerContext(request);
      if (ctx) {
        customerId = ctx.customer.id;
        phone = ctx.customer.phone ?? null;
      }
    } catch {
      /* anonymous */
    }

    await recordEvent(supabase, { type: data.type, carId: data.car_id ?? null, customerId, contactPhone: phone });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
