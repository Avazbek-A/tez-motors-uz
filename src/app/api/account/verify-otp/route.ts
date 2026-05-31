import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import {
  CUSTOMER_COOKIE,
  CUSTOMER_SESSION_TTL_SECONDS,
  normalizePhone,
} from "@/lib/customer-auth";
import { sha256Hex, generateOpaqueToken } from "@/lib/auth";
import { logEvent, reportServerError } from "@/lib/error-report";

const checkRateLimit = createKvRateLimiter({ max: 10, windowMs: 10 * 60 * 1000, prefix: "otp-verify" });

const MAX_ATTEMPTS = 5;

const schema = z.object({
  phone: z.string().min(5).max(20),
  code: z.string().regex(/^\d{6}$/),
  name: z.string().min(1).max(100).optional(),
  locale: z.enum(["ru", "uz", "en"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const body = await request.json().catch(() => null);
    const data = schema.parse(body);

    const phone = normalizePhone(data.phone);
    if (!phone) {
      return NextResponse.json({ success: false, error: "Invalid phone" }, { status: 400 });
    }

    if (!(await checkRateLimit(`${ip}:${phone}`))) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Please try again later." },
        { status: 429 },
      );
    }

    const supabase = createServiceClient();

    // Most recent live code for this phone.
    const { data: otp, error: otpErr } = await supabase
      .from("otp_codes")
      .select("id, code_hash, expires_at, attempts, consumed_at")
      .eq("phone", phone)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpErr || !otp) {
      return NextResponse.json({ success: false, error: "Code expired or not found" }, { status: 400 });
    }
    if (new Date(otp.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ success: false, error: "Code expired" }, { status: 400 });
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json({ success: false, error: "Too many attempts" }, { status: 429 });
    }

    const codeHash = await sha256Hex(`${phone}:${data.code}`);
    if (codeHash !== otp.code_hash) {
      await supabase
        .from("otp_codes")
        .update({ attempts: otp.attempts + 1 })
        .eq("id", otp.id);
      logEvent("auth.otp.fail", { ip, phone }, "warn");
      return NextResponse.json({ success: false, error: "Incorrect code" }, { status: 401 });
    }

    // Correct: burn the code so it can't be reused.
    await supabase.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);

    // Upsert the customer by phone (don't clobber an existing name with null).
    const { data: existing } = await supabase
      .from("customers")
      .select("id, name")
      .eq("phone", phone)
      .maybeSingle();

    let customerId: string;
    if (existing) {
      customerId = existing.id;
      await supabase
        .from("customers")
        .update({
          last_login_at: new Date().toISOString(),
          ...(data.name && !existing.name ? { name: data.name } : {}),
          ...(data.locale ? { locale: data.locale } : {}),
        })
        .eq("id", customerId);
    } else {
      const { data: created, error: createErr } = await supabase
        .from("customers")
        .insert({
          phone,
          name: data.name ?? null,
          locale: data.locale ?? "ru",
          last_login_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (createErr || !created) {
        reportServerError("POST /api/account/verify-otp (create customer)", createErr).catch(() => {});
        return NextResponse.json({ success: false, error: "Failed to create account" }, { status: 500 });
      }
      customerId = created.id;
    }

    // Issue a session: opaque token in cookie, only its hash stored.
    const token = generateOpaqueToken();
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + CUSTOMER_SESSION_TTL_SECONDS * 1000).toISOString();
    const { error: sessErr } = await supabase.from("customer_sessions").insert({
      customer_id: customerId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      ip: ip.slice(0, 64),
    });
    if (sessErr) {
      return NextResponse.json({ success: false, error: "Failed to create session" }, { status: 500 });
    }

    logEvent("auth.otp.ok", { ip, customer_id: customerId });

    const response = NextResponse.json({ success: true });
    response.cookies.set(CUSTOMER_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CUSTOMER_SESSION_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.issues }, { status: 400 });
    }
    reportServerError("POST /api/account/verify-otp", error).catch(() => {});
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
