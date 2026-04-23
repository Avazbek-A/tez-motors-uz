import { NextResponse } from "next/server";
import { ADMIN_COOKIE, extractToken, sha256Hex } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const token = extractToken(request);

  if (token) {
    try {
      const hash = await sha256Hex(token);
      const supabase = createServiceClient();
      await supabase.from("admin_sessions").delete().eq("token_hash", hash);
    } catch {
      // best-effort
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
