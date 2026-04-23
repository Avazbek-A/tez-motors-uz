/**
 * Best-effort in-memory rate limiter.
 *
 * Cloudflare Workers are effectively stateless across invocations, so this
 * limiter won't catch a distributed or patient attacker — it only slows down
 * bursts from a single IP that happen to land on the same isolate. For real
 * rate limiting, back this with KV or a Durable Object.
 */

type Entry = { count: number; resetAt: number };

export function createRateLimiter(opts: {
  max: number;
  windowMs: number;
  maxEntries?: number;
}) {
  const map = new Map<string, Entry>();
  const maxEntries = opts.maxEntries ?? 1000;

  return function check(key: string): boolean {
    const now = Date.now();
    if (map.size > maxEntries) {
      for (const [k, v] of map) {
        if (now > v.resetAt) map.delete(k);
      }
    }
    const entry = map.get(key);
    if (!entry || now > entry.resetAt) {
      map.set(key, { count: 1, resetAt: now + opts.windowMs });
      return true;
    }
    if (entry.count >= opts.max) return false;
    entry.count++;
    return true;
  };
}

export function getClientIp(request: Request | { headers: Headers }): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
