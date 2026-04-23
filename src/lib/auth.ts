import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const ADMIN_COOKIE = "admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

export interface AdminSessionContext {
  token: string;
  session: {
    token_hash: string;
    expires_at: string;
    user_id: string | null;
  };
  user: {
    id: string;
    email: string;
    role: "owner" | "manager" | "rep";
    disabled: boolean;
  } | null;
}

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

export async function getAdminSessionContext(
  request: NextRequest | Request,
): Promise<AdminSessionContext | null> {
  const token = extractToken(request);
  if (!token) return null;

  try {
    const hash = await sha256Hex(token);
    const supabase = createServiceClient();
    const { data: session, error } = await supabase
      .from("admin_sessions")
      .select("token_hash, expires_at, user_id")
      .eq("token_hash", hash)
      .maybeSingle();

    if (error || !session) return null;
    if (new Date(session.expires_at).getTime() <= Date.now()) return null;

    if (!session.user_id) {
      return {
        token,
        session,
        user: null,
      };
    }

    const { data: user, error: userError } = await supabase
      .from("admin_users")
      .select("id, email, role, disabled")
      .eq("id", session.user_id)
      .maybeSingle();

    if (userError || !user || user.disabled) return null;

    return {
      token,
      session,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        disabled: user.disabled,
      },
    };
  } catch {
    return null;
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

const PBKDF2_ITERATIONS = 310_000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function derivePasswordBits(password: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await derivePasswordBits(password, salt);
  return `pbkdf2$sha256$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 5) return false;
  const [scheme, hashName, iterationsRaw, saltB64, hashB64] = parts;
  if (scheme !== "pbkdf2" || hashName !== "sha256") return false;
  const iterations = Number.parseInt(iterationsRaw, 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = base64ToBytes(saltB64);
  const expected = base64ToBytes(hashB64);
  const actual = await derivePasswordBits(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
