import { describe, it, expect, vi, afterEach } from "vitest";
import { createRateLimiter, getClientIp } from "../rate-limit";

afterEach(() => {
  vi.useRealTimers();
});

describe("createRateLimiter", () => {
  it("allows up to max, then blocks", () => {
    const check = createRateLimiter({ max: 3, windowMs: 1000 });
    expect(check("ip")).toBe(true);
    expect(check("ip")).toBe(true);
    expect(check("ip")).toBe(true);
    expect(check("ip")).toBe(false);
  });

  it("tracks keys independently", () => {
    const check = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(check("a")).toBe(true);
    expect(check("b")).toBe(true);
    expect(check("a")).toBe(false);
    expect(check("b")).toBe(false);
  });

  it("resets after the window expires", () => {
    vi.useFakeTimers();
    const check = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(check("ip")).toBe(true);
    expect(check("ip")).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(check("ip")).toBe(true);
  });
});

describe("getClientIp", () => {
  it("prefers cf-connecting-ip", () => {
    const req = { headers: new Headers({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" }) };
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to the first x-forwarded-for entry", () => {
    const req = { headers: new Headers({ "x-forwarded-for": "5.6.7.8, 9.9.9.9" }) };
    expect(getClientIp(req)).toBe("5.6.7.8");
  });

  it("returns 'unknown' when no IP header is present", () => {
    const req = { headers: new Headers() };
    expect(getClientIp(req)).toBe("unknown");
  });
});
