import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendTelegramNotification } from "@/lib/telegram";
import { createServiceClient } from "@/lib/supabase/server";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

const checkRateLimit = createRateLimiter({ max: 3, windowMs: 5 * 60 * 1000 });

const callbackSchema = z.object({
  name: z.string().min(2).max(100).refine((s) => !/https?:\/\//i.test(s), "invalid name"),
  phone: z.string().min(5).max(20),
  // Honeypot: must be empty/absent
  website: z.string().max(0).optional(),
  turnstile_token: z.string().max(4096).optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!checkRateLimit(getClientIp(request))) {
      return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const data = callbackSchema.parse(body);

    const ok = await verifyTurnstile(data.turnstile_token, getClientIp(request));
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Captcha verification failed" },
        { status: 400 },
      );
    }

    // Persist to Supabase
    const supabase = createServiceClient();
    await supabase.from("inquiries").insert({
      name: data.name,
      phone: data.phone,
      type: "callback",
      status: "new",
      source_page: "callback-widget",
    });

    // Fire-and-forget Telegram notification
    sendTelegramNotification({
      name: data.name,
      phone: data.phone,
      type: "callback",
      source_page: "callback-widget",
    }).catch(() => {});

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, errors: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
