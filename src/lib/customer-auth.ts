/**
 * Customer (buyer) authentication — a faithful clone of the audited admin auth
 * (src/lib/auth.ts): an opaque random token in an httpOnly cookie, only its
 * SHA-256 hash stored server-side in customer_sessions, with a TTL. No JWT, no
 * token in localStorage. The only difference from admin auth is the identity
 * source: customers authenticate by phone + OTP (see src/lib/sms.ts), not a
 * password.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sha256Hex } from "@/lib/auth";

export const CUSTOMER_COOKIE = "customer_session";
export const CUSTOMER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface CustomerContext {
  token: string;
  customer: {
    id: string;
    phone: string;
    name: string | null;
    email: string | null;
    locale: "ru" | "uz" | "en";
  };
}

export async function getCustomerContext(
  request: NextRequest | Request,
): Promise<CustomerContext | null> {
  const token = extractCustomerToken(request);
  if (!token) return null;

  try {
    const hash = await sha256Hex(token);
    const supabase = createServiceClient();
    const { data: session, error } = await supabase
      .from("customer_sessions")
      .select("customer_id, expires_at")
      .eq("token_hash", hash)
      .maybeSingle();

    if (error || !session) return null;
    if (new Date(session.expires_at).getTime() <= Date.now()) return null;

    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("id, phone, name, email, locale")
      .eq("id", session.customer_id)
      .maybeSingle();

    if (custErr || !customer) return null;

    return {
      token,
      customer: {
        id: customer.id,
        phone: customer.phone,
        name: customer.name ?? null,
        email: customer.email ?? null,
        locale:
          customer.locale === "uz" || customer.locale === "en" ? customer.locale : "ru",
      },
    };
  } catch {
    return null;
  }
}

/**
 * Returns the authenticated customer, or a 401 NextResponse to short-circuit a
 * route handler. Mirrors requireAdmin's shape.
 */
export async function requireCustomer(
  request: NextRequest | Request,
): Promise<{ context: CustomerContext } | { response: NextResponse }> {
  const context = await getCustomerContext(request);
  if (!context) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { context };
}

export function extractCustomerToken(request: NextRequest | Request): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieMatch = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${CUSTOMER_COOKIE}=([^;]+)`),
  );
  return cookieMatch ? cookieMatch[1] : null;
}

/**
 * Normalize an Uzbek phone to a canonical +998XXXXXXXXX form so the same person
 * keying "+998 90 123 45 67", "998901234567", or "901234567" lands on one
 * customer row. Returns null if it can't be coerced to 9 national digits.
 */
export function normalizePhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  // Strip a leading country code (998) or a national trunk 0.
  let national = digits;
  if (national.startsWith("998")) national = national.slice(3);
  if (national.length === 10 && national.startsWith("0")) national = national.slice(1);
  if (national.length !== 9) return null;
  return `+998${national}`;
}
