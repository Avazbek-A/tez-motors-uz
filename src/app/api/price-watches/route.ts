import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";

const checkRateLimit = createKvRateLimiter({ max: 10, windowMs: 10 * 60 * 1000, prefix: "price-watch" });

const schema = z.object({
  email: z.string().email().max(200),
  car_id: z.string().uuid(),
  target_price_usd: z.number().positive().max(100_000_000),
  turnstile_token: z.string().max(4096).optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!(await checkRateLimit(getClientIp(request)))) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
    }

    const ok = await verifyTurnstile(parsed.data.turnstile_token, getClientIp(request));
    if (!ok) {
      return NextResponse.json({ error: "Captcha verification failed" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from("price_watches").insert({
      email: parsed.data.email.toLowerCase(),
      car_id: parsed.data.car_id,
      target_price_usd: parsed.data.target_price_usd,
    });

    if (error) {
      return NextResponse.json({ error: "Failed to save watch" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
