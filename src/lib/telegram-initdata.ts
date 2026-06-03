/**
 * Validate a Telegram Mini App `initData` payload (the WebApp authentication
 * scheme). Web Crypto only — Workers-safe. The algorithm (per Telegram docs):
 *
 *   data_check_string = every "key=value" pair EXCEPT `hash`, sorted by key,
 *                       joined with "\n"
 *   secret_key        = HMAC_SHA256(key="WebAppData", message=<bot_token>)
 *   expected_hash     = hex( HMAC_SHA256(key=secret_key, message=data_check_string) )
 *   valid  ⇔  expected_hash === initData.hash   (constant-time)
 *
 * We also reject stale payloads (auth_date older than maxAgeSeconds) to limit
 * replay. Pure + unit-tested; the route layers rate-limiting and the session on
 * top.
 */
import { timingSafeEqual } from "./timing-safe";

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface InitDataResult {
  valid: boolean;
  user?: TelegramUser;
  reason?: string;
}

const enc = new TextEncoder();

async function hmacSha256(keyBytes: Uint8Array | ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", keyBytes as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", key, enc.encode(message));
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Map a Telegram language_code to one of our supported locales. */
export function telegramLocale(code?: string): "ru" | "uz" | "en" {
  const c = (code || "").toLowerCase();
  if (c.startsWith("uz")) return "uz";
  if (c.startsWith("en")) return "en";
  return "ru";
}

/**
 * Build the data-check-string from raw initData. Exported for unit tests so the
 * exact ordering/exclusion is verified independently of the crypto.
 */
export function buildDataCheckString(initData: string): { dataCheckString: string; hash: string | null } {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  return { dataCheckString: pairs.join("\n"), hash };
}

export async function validateInitData(
  initData: string,
  botToken: string,
  opts: { maxAgeSeconds?: number; nowMs?: number } = {},
): Promise<InitDataResult> {
  if (!initData || !botToken) return { valid: false, reason: "missing-input" };

  const { dataCheckString, hash } = buildDataCheckString(initData);
  if (!hash) return { valid: false, reason: "no-hash" };

  let expectedHex: string;
  try {
    const secretKey = await hmacSha256(enc.encode("WebAppData"), botToken);
    const sig = await hmacSha256(new Uint8Array(secretKey), dataCheckString);
    expectedHex = toHex(sig);
  } catch {
    return { valid: false, reason: "crypto-error" };
  }

  if (!timingSafeEqual(expectedHex, hash)) return { valid: false, reason: "bad-hash" };

  // Freshness — reject stale auth_date (default 24h) to blunt replay.
  const maxAge = opts.maxAgeSeconds ?? 86_400;
  const params = new URLSearchParams(initData);
  const authDate = Number(params.get("auth_date"));
  if (Number.isFinite(authDate) && authDate > 0) {
    const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);
    if (nowSec - authDate > maxAge) return { valid: false, reason: "expired" };
  }

  // Parse the user object (present for normal Mini App launches).
  let user: TelegramUser | undefined;
  const userRaw = params.get("user");
  if (userRaw) {
    try {
      const parsed = JSON.parse(userRaw);
      if (parsed && typeof parsed.id === "number") user = parsed as TelegramUser;
    } catch {
      // user is optional; a valid hash without a parseable user is still valid
    }
  }

  return { valid: true, user };
}
