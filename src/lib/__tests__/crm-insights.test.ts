import { describe, it, expect } from "vitest";
import { customerTier, daysSince, tierLabel, tierRank } from "../crm-insights";

describe("customerTier", () => {
  it("marks big-deposit or repeat buyers as VIP", () => {
    expect(customerTier({ ordersCount: 1, depositsUsd: 6000, lastSeenDaysAgo: 3 })).toBe("vip");
    expect(customerTier({ ordersCount: 2, depositsUsd: 500, lastSeenDaysAgo: 40 })).toBe("vip");
  });
  it("marks any order or deposit as buyer", () => {
    expect(customerTier({ ordersCount: 1, depositsUsd: 0, lastSeenDaysAgo: 100 })).toBe("buyer");
    expect(customerTier({ ordersCount: 0, depositsUsd: 200, lastSeenDaysAgo: 5 })).toBe("buyer");
  });
  it("marks cold no-purchase contacts dormant after 90 days", () => {
    expect(customerTier({ ordersCount: 0, depositsUsd: 0, lastSeenDaysAgo: 120 })).toBe("dormant");
  });
  it("marks recent or hot-score contacts active", () => {
    expect(customerTier({ ordersCount: 0, depositsUsd: 0, lastSeenDaysAgo: 5 })).toBe("active");
    expect(customerTier({ ordersCount: 0, depositsUsd: 0, lastSeenDaysAgo: 60, leadScore: 70 })).toBe("active");
  });
  it("defaults cool known contacts to lead", () => {
    expect(customerTier({ ordersCount: 0, depositsUsd: 0, lastSeenDaysAgo: 40 })).toBe("lead");
    expect(customerTier({ ordersCount: 0, depositsUsd: 0, lastSeenDaysAgo: null })).toBe("lead");
  });
});

describe("daysSince", () => {
  const now = Date.parse("2026-06-10T00:00:00Z");
  it("computes whole days", () => {
    expect(daysSince("2026-06-01T00:00:00Z", now)).toBe(9);
    expect(daysSince("2026-06-10T00:00:00Z", now)).toBe(0);
  });
  it("returns null for missing/invalid", () => {
    expect(daysSince(null, now)).toBeNull();
    expect(daysSince("not-a-date", now)).toBeNull();
  });
});

describe("tier label / rank", () => {
  it("labels and ranks tiers vip-first", () => {
    expect(tierLabel("vip")).toBe("VIP");
    expect(tierRank("vip")).toBeLessThan(tierRank("lead"));
    expect(tierRank("buyer")).toBeLessThan(tierRank("dormant"));
  });
});
