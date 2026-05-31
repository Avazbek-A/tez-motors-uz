import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CUSTOMER_COOKIE, extractCustomerToken } from "@/lib/customer-auth";
import { sha256Hex } from "@/lib/auth";

// Delete the server-side session row (so a copied cookie is revoked) and clear
// the cookie. Mirrors the admin logout flow.
export async function POST(request: NextRequest) {
  const token = extractCustomerToken(request);
  if (token) {
    try {
      const hash = await sha256Hex(token);
      const supabase = createServiceClient();
      await supabase.from("customer_sessions").delete().eq("token_hash", hash);
    } catch {
      // ignore — we still clear the cookie below
    }
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set(CUSTOMER_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
