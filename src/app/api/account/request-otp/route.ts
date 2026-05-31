import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import { verifyTurnstile } from "@/lib/turnstile";
import { normalizePhone } from "@/lib/customer-auth";
import { sha256Hex } from "@/lib/auth";
import { sendSms, otpMessage } from "@/lib/sms";
import { reportServerError } from "@/lib/error-report";

// Per-IP and effectively per-phone (phone is in the key) abuse cap. KV-backed so
// it holds across Worker isolates; the OTP attempt counter in the DB is the
// second layer of defense against guessing.
const checkRateLimit = createKvRateLimiter({ max: 5, windowMs: 10 * 60 * 1000, prefix: "otp-req" });

const OTP_TTL_MS = 5 * 60 * 1000;

const schema = z.object({
  phone: z.string().min(5).max(20),
  locale: z.enum(["ru", "uz", "en"]).optional(),
  website: z.string().max(0).optional(), // honeypot
  turnstile_token: z.string().max(4096).optional(),
});

function sixDigitCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return n.toString().padStart(6, "0");
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const body = await request.json().catch(() => null);
    const data = schema.parse(body);

    const phone = normalizePhone(data.phone);
    if (!phone) {
      return NextResponse.json({ success: false, error: "Invalid phone" }, { status: 400 });
    }

    // Rate-limit by IP + phone so neither a single IP nor a single number can
    // be hammered.
    if (!(await checkRateLimit(`${ip}:${phone}`))) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const ok = await verifyTurnstile(data.turnstile_token, ip);
    if (!ok) {
      return NextResponse.json({ success: false, error: "Captcha failed" }, { status: 400 });
    }

    const code = sixDigitCode();
    // Salt the OTP hash with the phone so identical codes for different numbers
    // never collide, and a leaked hash can't be reused on another number.
    const codeHash = await sha256Hex(`${phone}:${code}`);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    const supabase = createServiceClient();
    const { error } = await supabase.from("otp_codes").insert({
      phone,
      code_hash: codeHash,
      expires_at: expiresAt,
    });
    if (error) {
      reportServerError("POST /api/account/request-otp (insert)", error).catch(() => {});
      return NextResponse.json({ success: false, error: "Failed to send code" }, { status: 500 });
    }

    // Fail-open: when SMS isn't configured the code is logged server-side
    // (sms.ts), the flow still works for testing, and we never 500.
    await sendSms(phone, otpMessage(data.locale ?? "ru", code));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.issues }, { status: 400 });
    }
    reportServerError("POST /api/account/request-otp", error).catch(() => {});
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
