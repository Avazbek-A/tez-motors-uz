import { describe, it, expect } from "vitest";
import { normalizeContact, unsubscribeToken, verifyUnsubscribeToken, isSuppressed } from "../automation/suppression";
import type { SupabaseClient } from "@supabase/supabase-js";

function fakeSupabase(rows: Array<{ channel: string | null }>): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    limit: () => Promise.resolve({ data: rows }),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

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

describe("isSuppressed", () => {
  it("returns false when the contact has no suppression rows", async () => {
    expect(await isSuppressed(fakeSupabase([]), "bek@example.com", "email")).toBe(false);
  });
  it("an 'all' (null-channel) row blocks every channel", async () => {
    const sb = fakeSupabase([{ channel: null }]);
    expect(await isSuppressed(sb, "bek@example.com", "email")).toBe(true);
    expect(await isSuppressed(sb, "bek@example.com", "telegram")).toBe(true);
  });
  it("a channel-specific row blocks only that channel for a targeted send", async () => {
    const sb = fakeSupabase([{ channel: "email" }]);
    expect(await isSuppressed(sb, "bek@example.com", "email")).toBe(true);
    expect(await isSuppressed(sb, "bek@example.com", "telegram")).toBe(false);
  });
  it("an untargeted send ('auto'/undefined/null) is blocked by ANY opt-out", async () => {
    // Regression: an 'auto' journey step fans out across channels, so a
    // channel-specific opt-out must not be bypassed by an untargeted send.
    const sb = fakeSupabase([{ channel: "email" }]);
    expect(await isSuppressed(sb, "bek@example.com", "auto")).toBe(true);
    expect(await isSuppressed(sb, "bek@example.com")).toBe(true);
    expect(await isSuppressed(sb, "bek@example.com", null)).toBe(true);
  });
});
