/**
 * HMAC-SHA256 via Web Crypto (Workers-safe — no node:crypto). Used to verify
 * webhook signatures (e.g. Meta's X-Hub-Signature-256). The compare is
 * constant-time.
 */
import { timingSafeEqual } from "./timing-safe";

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** True iff `providedHex` is the valid HMAC-SHA256 of `message` under `secret`. */
export async function verifyHmacSha256(secret: string, message: string, providedHex: string): Promise<boolean> {
  if (!secret || !providedHex) return false;
  const expected = await hmacSha256Hex(secret, message);
  return timingSafeEqual(expected, providedHex.trim().toLowerCase());
}
