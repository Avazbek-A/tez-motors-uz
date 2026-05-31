/**
 * Auth chokepoint tests: the opaque-token + SHA-256 session model and the
 * PBKDF2 password hashing that gate the admin panel, plus the customer-side
 * token extraction and phone normalization. These govern who can write to the
 * money/CRM surfaces, so they earn coverage beyond the pure-math libs.
 */
import { describe, it, expect } from "vitest";
import {
  sha256Hex,
  generateOpaqueToken,
  hashPassword,
  verifyPassword,
  extractToken,
  ADMIN_COOKIE,
} from "../auth";
import { extractCustomerToken, normalizePhone, CUSTOMER_COOKIE } from "../customer-auth";

function reqWith(headers: Record<string, string>): Request {
  return new Request("https://tezmotors.uz/api/admin/x", { headers });
}

describe("sha256Hex", () => {
  it("is deterministic and 64 hex chars", async () => {
    const a = await sha256Hex("token-abc");
    const b = await sha256Hex("token-abc");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for different inputs", async () => {
    expect(await sha256Hex("a")).not.toBe(await sha256Hex("b"));
  });
});

describe("generateOpaqueToken", () => {
  it("returns 64 hex chars (32 bytes of entropy)", () => {
    expect(generateOpaqueToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is unique across calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateOpaqueToken());
    expect(seen.size).toBe(200);
  });
});

describe("password hashing (PBKDF2)", () => {
  it("verifies the correct password", async () => {
    const stored = await hashPassword("s3cret-pw");
    expect(stored.startsWith("pbkdf2$sha256$")).toBe(true);
    expect(await verifyPassword("s3cret-pw", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("s3cret-pw");
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });

  it("uses a random salt (same password → different hashes)", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same", a)).toBe(true);
    expect(await verifyPassword("same", b)).toBe(true);
  });

  it("rejects a malformed stored hash", async () => {
    expect(await verifyPassword("x", "garbage")).toBe(false);
    expect(await verifyPassword("x", "md5$nope$1$a$b")).toBe(false);
  });
});

describe("extractToken (admin)", () => {
  it("reads the admin cookie", () => {
    const req = reqWith({ cookie: `${ADMIN_COOKIE}=abc123; other=1` });
    expect(extractToken(req)).toBe("abc123");
  });

  it("falls back to a Bearer header", () => {
    const req = reqWith({ authorization: "Bearer tok-xyz" });
    expect(extractToken(req)).toBe("tok-xyz");
  });

  it("returns null when neither present", () => {
    expect(extractToken(reqWith({}))).toBeNull();
  });
});

describe("extractCustomerToken", () => {
  it("reads the customer cookie", () => {
    const req = reqWith({ cookie: `${CUSTOMER_COOKIE}=cust-tok; x=2` });
    expect(extractCustomerToken(req)).toBe("cust-tok");
  });

  it("does not fall back to Bearer (cookie-only)", () => {
    const req = reqWith({ authorization: "Bearer nope" });
    expect(extractCustomerToken(req)).toBeNull();
  });
});

describe("normalizePhone", () => {
  it("canonicalizes the common Uzbek phone forms to +998XXXXXXXXX", () => {
    expect(normalizePhone("+998 90 123 45 67")).toBe("+998901234567");
    expect(normalizePhone("998901234567")).toBe("+998901234567");
    expect(normalizePhone("901234567")).toBe("+998901234567");
  });

  it("returns null for an un-coercible length", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});
