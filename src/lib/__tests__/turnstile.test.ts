import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { verifyTurnstile } from "@/lib/turnstile";

const OLD = { ...process.env };

describe("verifyTurnstile", () => {
  beforeEach(() => {
    process.env.TURNSTILE_SECRET = "test-secret";
    delete process.env.TURNSTILE_STRICT;
  });
  afterEach(() => {
    process.env = { ...OLD };
    vi.restoreAllMocks();
  });

  it("skips verification entirely when no secret is configured", async () => {
    delete process.env.TURNSTILE_SECRET;
    expect(await verifyTurnstile(null)).toBe(true);
  });

  it("lets a tokenless submission through — a broken widget must not eat the funnel", async () => {
    expect(await verifyTurnstile(null)).toBe(true);
    expect(await verifyTurnstile(undefined)).toBe(true);
  });

  it("refuses a tokenless submission when TURNSTILE_STRICT is on", async () => {
    process.env.TURNSTILE_STRICT = "true";
    expect(await verifyTurnstile(null)).toBe(false);
  });

  it("still rejects a token that fails verification — that is the forgery case", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 })));
    expect(await verifyTurnstile("forged-token")).toBe(false);
  });

  it("accepts a token Cloudflare confirms", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })));
    expect(await verifyTurnstile("good-token")).toBe(true);
  });

  it("fails open when the verify call itself cannot be made", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    expect(await verifyTurnstile("some-token")).toBe(true);
  });
});
