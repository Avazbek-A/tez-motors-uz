/**
 * KV-backed rate limiter fallback. In the test (node) environment there is no
 * Cloudflare context, so getKv() returns null and the limiter must degrade to
 * the in-memory limiter rather than throw — this is the fail-open guarantee the
 * form-hardening spine depends on when KV is unbound.
 */
import { describe, it, expect } from "vitest";
import { createKvRateLimiter } from "../rate-limit-kv";

describe("createKvRateLimiter (no KV binding → in-memory fallback)", () => {
  it("allows up to max then blocks, without throwing", async () => {
    const check = createKvRateLimiter({ max: 2, windowMs: 1000, prefix: "test" });
    expect(await check("ip-1")).toBe(true);
    expect(await check("ip-1")).toBe(true);
    expect(await check("ip-1")).toBe(false);
  });

  it("tracks keys independently", async () => {
    const check = createKvRateLimiter({ max: 1, windowMs: 1000, prefix: "test2" });
    expect(await check("a")).toBe(true);
    expect(await check("b")).toBe(true);
    expect(await check("a")).toBe(false);
  });
});
