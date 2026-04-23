import { NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_COOKIE } from "@/lib/auth";
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
  const sessionToken = process.env.ADMIN_SESSION_TOKEN;
  if (!expected || !sessionToken) {
    return NextResponse.json({ error: "Admin auth not configured" }, { status: 500 });
  }

  if (parsed.data.password !== expected) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return response;
}
