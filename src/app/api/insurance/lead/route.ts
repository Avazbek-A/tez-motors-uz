import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import { verifyTurnstile } from "@/lib/turnstile";
import { notifyNewInquiry } from "@/lib/notify";

/**
 * Insurance attach lead (Phase AP). Captures intent to buy OSAGO/KASKO into
 * insurance_leads and alerts the dealer to bind via a partner. Lead-capture
 * only. Hardened: KV rate-limit + Turnstile + honeypot + zod.
 */
const checkRateLimit = createKvRateLimiter({ max: 5, windowMs: 10 * 60 * 1000, prefix: "ins-lead" });

const schema = z.object({
  name: z.string().min(2).max(100).optional().nullable(),
  phone: z.string().min(5).max(20),
  car_id: z.string().uuid().optional().nullable(),
  type: z.enum(["osago", "kasko"]),
  estimated_premium_usd: z.number().min(0).max(1_000_000).optional().nullable(),
  locale: z.enum(["ru", "uz", "en"]).optional(),
  website: z.string().max(0).optional(), // honeypot
  turnstile_token: z.string().max(4096).optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!(await checkRateLimit(getClientIp(request)))) {
      return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }
    const data = schema.parse(await request.json());
    if (data.website) return NextResponse.json({ success: true }, { status: 201 }); // honeypot

    const ok = await verifyTurnstile(data.turnstile_token, getClientIp(request));
    if (!ok) {
      return NextResponse.json({ success: false, error: "Captcha verification failed" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from("insurance_leads").insert({
      customer_name: data.name ?? null,
      customer_phone: data.phone,
      car_id: data.car_id ?? null,
      type: data.type,
      estimated_premium_usd: data.estimated_premium_usd ?? null,
      status: "new",
    });
    if (error) {
      return NextResponse.json({ success: false, error: "Failed to save lead" }, { status: 500 });
    }

    notifyNewInquiry({
      name: data.name || "Insurance lead",
      phone: data.phone,
      type: "callback",
      message: `Insurance interest: ${data.type.toUpperCase()}${data.estimated_premium_usd ? ` (~$${Math.round(data.estimated_premium_usd)}/yr)` : ""}`,
      source_page: "insurance",
      locale: data.locale,
    }).catch(() => {});

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
