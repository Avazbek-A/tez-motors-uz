import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import { CUSTOMER_COOKIE, CUSTOMER_SESSION_TTL_SECONDS } from "@/lib/customer-auth";
import { sha256Hex, generateOpaqueToken } from "@/lib/auth";
import { validateInitData, telegramLocale } from "@/lib/telegram-initdata";
import { logEvent, reportServerError } from "@/lib/error-report";

/**
 * Telegram Mini App sign-in. The client posts `window.Telegram.WebApp.initData`;
 * we validate its HMAC against TELEGRAM_BOT_TOKEN (see telegram-initdata.ts),
 * upsert the customer by telegram_id (phone stays null until they share one),
 * and issue the same customer_session cookie the OTP flow uses. Fail-CLOSED on
 * invalid initData; rate-limited; no-op if the bot token is unset.
 */
const schema = z.object({ initData: z.string().min(1).max(8000) });
const checkRateLimit = createKvRateLimiter({ max: 30, windowMs: 10 * 60 * 1000, prefix: "tg-auth" });

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(ip))) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ success: false, error: "Telegram sign-in is not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Validation failed" }, { status: 400 });
  }

  // Reject initData older than 1h to keep the replay window tight (the validator
  // defaults to 24h). A Mini App always carries fresh initData on open.
  const result = await validateInitData(parsed.data.initData, botToken, { maxAgeSeconds: 3600 });
  if (!result.valid || !result.user) {
    logEvent("auth.tg.reject", { ip, reason: result.reason ?? "no-user" });
    return NextResponse.json({ success: false, error: "Invalid Telegram session" }, { status: 401 });
  }

  const tg = result.user;
  const locale = telegramLocale(tg.language_code);
  const name = [tg.first_name, tg.last_name].filter(Boolean).join(" ") || tg.username || null;

  try {
    const supabase = createServiceClient();
    const nowIso = new Date().toISOString();

    const { data: existing } = await supabase
      .from("customers")
      .select("id, name")
      .eq("telegram_id", tg.id)
      .maybeSingle();

    let customerId: string;
    if (existing) {
      customerId = existing.id;
      await supabase
        .from("customers")
        .update({ last_login_at: nowIso, ...(name && !existing.name ? { name } : {}) })
        .eq("id", customerId);
    } else {
      const { data: created, error: createErr } = await supabase
        .from("customers")
        .insert({ telegram_id: tg.id, name, locale, last_login_at: nowIso })
        .select("id")
        .single();
      if (createErr || !created) {
        reportServerError("POST /api/tg/auth (create customer)", createErr).catch(() => {});
        return NextResponse.json({ success: false, error: "Failed to create account" }, { status: 500 });
      }
      customerId = created.id;
    }

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

    logEvent("auth.tg.ok", { ip, customer_id: customerId });

    const response = NextResponse.json({ success: true, customer: { name, locale } });
    response.cookies.set(CUSTOMER_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CUSTOMER_SESSION_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    reportServerError("POST /api/tg/auth", error).catch(() => {});
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
