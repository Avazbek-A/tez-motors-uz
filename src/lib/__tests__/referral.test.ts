import { describe, it, expect } from "vitest";
import { makeReferralCode } from "../automation/referral";

describe("makeReferralCode", () => {
  it("is 6 unambiguous uppercase chars", () => {
    const code = makeReferralCode();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });
  it("avoids ambiguous characters (0/O/1/I)", () => {
    for (let i = 0; i < 50; i++) {
      expect(makeReferralCode()).not.toMatch(/[01OI]/);
    }
  });
  it("is reasonably unique across draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(makeReferralCode());
    expect(seen.size).toBeGreaterThan(190); // collisions vanishingly rare
  });
});
