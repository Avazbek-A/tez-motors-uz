import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const ADMIN_COOKIE = "admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

export async function requireAdmin(
  request: NextRequest | Request,
): Promise<NextResponse | null> {
  if (await isAdminRequest(request)) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function isAdminRequest(
  request: NextRequest | Request,
): Promise<boolean> {
  const token = extractToken(request);
  if (!token) return false;

  // Legacy static env-based check (will be removed after session rotation ships).
  const legacy = process.env.ADMIN_SESSION_TOKEN;
  if (legacy && timingSafeEqual(token, legacy)) return true;

  try {
    const hash = await sha256Hex(token);
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("admin_sessions")
      .select("expires_at")
      .eq("token_hash", hash)
      .maybeSingle();

    if (error || !data) return false;
    if (new Date(data.expires_at).getTime() <= Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

export function extractToken(request: NextRequest | Request): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieMatch = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`),
  );
  if (cookieMatch) return cookieMatch[1];

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length);
  }
  return null;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateOpaqueToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
