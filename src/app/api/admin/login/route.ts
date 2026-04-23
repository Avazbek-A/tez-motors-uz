import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ADMIN_COOKIE,
  SESSION_TTL_SECONDS,
  generateOpaqueToken,
  sha256Hex,
} from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

const schema = z.object({ password: z.string().min(1).max(200) });
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

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "Admin auth not configured" }, { status: 500 });
  }

  if (parsed.data.password !== expected) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = generateOpaqueToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("admin_sessions").insert({
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
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
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
