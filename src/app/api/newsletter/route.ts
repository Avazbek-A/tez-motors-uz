import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

const checkRateLimit = createRateLimiter({ max: 3, windowMs: 5 * 60 * 1000 });

const schema = z.object({
  email: z.string().email().max(200),
  source_page: z.string().optional(),
  turnstile_token: z.string().max(4096).optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!checkRateLimit(getClientIp(request))) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const data = schema.parse(body);

    const ok = await verifyTurnstile(data.turnstile_token, getClientIp(request));
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Captcha verification failed" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const { error } = await supabase.from("inquiries").insert({
      name: "Newsletter Subscriber",
      phone: "-",
      email: data.email,
      type: "newsletter",
      status: "new",
      source_page: data.source_page || "newsletter-widget",
      message: `Email subscription: ${data.email}`,
    });

    if (error) throw error;

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
