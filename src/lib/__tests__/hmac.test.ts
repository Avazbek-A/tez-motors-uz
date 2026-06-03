import { describe, it, expect } from "vitest";
import { hmacSha256Hex, verifyHmacSha256 } from "../hmac";

// Well-known test vector: HMAC-SHA256(key="key", "The quick brown fox jumps over the lazy dog")
const MSG = "The quick brown fox jumps over the lazy dog";
const KEY = "key";
const EXPECTED = "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8";

describe("hmacSha256Hex", () => {
  it("matches the known HMAC-SHA256 vector", async () => {
    expect(await hmacSha256Hex(KEY, MSG)).toBe(EXPECTED);
  });
});

describe("verifyHmacSha256", () => {
  it("accepts the correct signature (case-insensitive, trimmed)", async () => {
    expect(await verifyHmacSha256(KEY, MSG, EXPECTED)).toBe(true);
    expect(await verifyHmacSha256(KEY, MSG, `  ${EXPECTED.toUpperCase()}  `)).toBe(true);
  });
  it("rejects a wrong signature, secret, or message", async () => {
    expect(await verifyHmacSha256(KEY, MSG, EXPECTED.replace(/.$/, "0"))).toBe(false);
    expect(await verifyHmacSha256("wrong", MSG, EXPECTED)).toBe(false);
    expect(await verifyHmacSha256(KEY, "tampered", EXPECTED)).toBe(false);
  });
  it("rejects empty secret or signature", async () => {
    expect(await verifyHmacSha256("", MSG, EXPECTED)).toBe(false);
    expect(await verifyHmacSha256(KEY, MSG, "")).toBe(false);
  });
});
