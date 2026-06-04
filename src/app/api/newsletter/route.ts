import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendEmail, newsletterWelcomeEmail } from "@/lib/email";

// KV-backed so the cap is shared across Workers isolates.
const checkRateLimit = createKvRateLimiter({ max: 3, windowMs: 5 * 60 * 1000, prefix: "newsletter" });

const schema = z.object({
  email: z.string().email().max(200),
  locale: z.enum(["ru", "uz", "en"]).optional(),
  // Cap source_page so it can't be used to bloat the row (this string is
  // attacker-controllable and stored as-is).
  source_page: z.string().max(200).optional(),
  turnstile_token: z.string().max(4096).optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!(await checkRateLimit(getClientIp(request)))) {
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
    const locale = data.locale ?? "ru";

    // Upsert; ignoreDuplicates means a re-subscribe is a no-op and returns no
    // row, so we only send the welcome email on a genuinely new subscription.
    const { data: inserted, error } = await supabase
      .from("newsletter_subscribers")
      .upsert(
        {
          email: data.email,
          locale,
          source_page: data.source_page || "newsletter-widget",
        },
        { onConflict: "email", ignoreDuplicates: true },
      )
      .select("id");

    if (error) throw error;

    if (inserted && inserted.length > 0) {
      const tpl = newsletterWelcomeEmail(locale);
      sendEmail({ to: data.email, subject: tpl.subject, html: tpl.html }).catch(() => {});
    }

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
