/**
 * Durable, KV-backed rate limiter for hot public POSTs.
 *
 * The in-memory limiter in ./rate-limit.ts only sees one Worker isolate, so a
 * patient or distributed attacker walks right past it. This variant counts in
 * Cloudflare KV (shared across isolates) with a TTL window. KV is eventually
 * consistent and get→put isn't atomic, so this is COARSE abuse limiting — keep
 * Turnstile + the honeypot as the real gate. It is defense-in-depth.
 *
 * Fail-open: when no KV binding is present (local dev, unbound preview) it falls
 * back to the in-memory limiter so behavior degrades to today's, never 500s.
 */
import { getKv } from "./cf-env";
import { createRateLimiter } from "./rate-limit";

// KV's minimum expirationTtl is 60 seconds; clamp anything shorter.
const KV_MIN_TTL_SECONDS = 60;

export function createKvRateLimiter(opts: {
  max: number;
  windowMs: number;
  /** Namespaces the KV key so different routes don't share a bucket. */
  prefix: string;
}) {
  const fallback = createRateLimiter({ max: opts.max, windowMs: opts.windowMs });
  const ttlSeconds = Math.max(KV_MIN_TTL_SECONDS, Math.ceil(opts.windowMs / 1000));

  /** Returns true when the request is allowed, false when over the limit. */
  return async function check(key: string): Promise<boolean> {
    const kv = await getKv("RATE_LIMIT_KV");
    if (!kv) return fallback(key);

    const k = `rl:${opts.prefix}:${key}`;
    try {
      const raw = await kv.get(k);
      const count = raw ? parseInt(raw, 10) || 0 : 0;
      if (count >= opts.max) return false;
      // Re-put with a fresh TTL. Resetting the window on each hit makes a
      // sustained attacker strictly more limited, which is the desired bias.
      await kv.put(k, String(count + 1), { expirationTtl: ttlSeconds });
      return true;
    } catch {
      // KV hiccup — never block a legitimate request on the limiter.
      return fallback(key);
    }
  };
}
