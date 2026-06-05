import { describe, it, expect } from "vitest";
import { normalizeContact, unsubscribeToken, verifyUnsubscribeToken } from "../automation/suppression";

describe("normalizeContact", () => {
  it("lowercases emails", () => {
    expect(normalizeContact("  Bek@Example.COM ")).toBe("bek@example.com");
  });
  it("reduces phones to a comparable form", () => {
    const a = normalizeContact("+998 90 123 45 67");
    const b = normalizeContact("998901234567");
    expect(a).toBe(b);
  });
});

describe("unsubscribe token", () => {
  it("round-trips: a token verifies for its contact", async () => {
    const tok = await unsubscribeToken("bek@example.com");
    expect(await verifyUnsubscribeToken("bek@example.com", tok)).toBe(true);
  });
  it("rejects a token for a different contact", async () => {
    const tok = await unsubscribeToken("bek@example.com");
    expect(await verifyUnsubscribeToken("someone@else.com", tok)).toBe(false);
  });
  it("rejects a garbage token", async () => {
    expect(await verifyUnsubscribeToken("bek@example.com", "nope")).toBe(false);
  });
  it("is stable for the same normalized contact", async () => {
    const a = await unsubscribeToken("+998 90 123 45 67");
    const b = await unsubscribeToken("998901234567");
    expect(a).toBe(b);
  });
});
