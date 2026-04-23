import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ADMIN_COOKIE,
  SESSION_TTL_SECONDS,
  generateOpaqueToken,
  sha256Hex,
  verifyPassword,
} from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email().max(200).optional().or(z.literal("")),
  password: z.string().min(1).max(200),
});
const checkAttempts = createRateLimiter({ max: 10, windowMs: 10 * 60 * 1000 });

export async function POST(request: Request) {
  if (!checkAttempts(getClientIp(request))) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const servicePassword = process.env.ADMIN_PASSWORD;
  if (!servicePassword && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Admin auth not configured" }, { status: 500 });
  }

  const token = generateOpaqueToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const email = parsed.data.email?.trim().toLowerCase() || null;

  try {
    const supabase = createServiceClient();
    let userId: string | null = null;

    if (email) {
      const { data: user } = await supabase
        .from("admin_users")
        .select("id, password_hash, disabled")
        .eq("email", email)
        .maybeSingle();

      if (user && !user.disabled && await verifyPassword(parsed.data.password, user.password_hash)) {
        userId = user.id;
      }
    }

    if (!userId) {
      if (!servicePassword || parsed.data.password !== servicePassword) {
        return NextResponse.json({ error: "Incorrect credentials" }, { status: 401 });
      }
    }

    const { error } = await supabase.from("admin_sessions").insert({
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      user_id: userId,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      ip: getClientIp(request).slice(0, 64),
    });
    if (error) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
