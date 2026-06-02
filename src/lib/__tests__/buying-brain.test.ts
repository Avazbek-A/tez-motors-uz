import { describe, it, expect } from "vitest";
import { demandScore, opportunityScore, verdict, recommendedQty, verdictLabel } from "../buying-brain";

describe("demandScore", () => {
  it("is 0 with no signals", () => {
    expect(demandScore({ inquiries: 0, savedSearches: 0, watches: 0, favorites: 0 })).toBe(0);
  });
  it("weights inquiries most and saturates", () => {
    const few = demandScore({ inquiries: 1, savedSearches: 0, watches: 0, favorites: 0 });
    const many = demandScore({ inquiries: 20, savedSearches: 10, watches: 10, favorites: 10 });
    expect(few).toBeGreaterThan(0);
    expect(few).toBeLessThan(40);
    expect(many).toBeGreaterThan(90);
    expect(many).toBeLessThanOrEqual(100);
  });
  it("inquiries outweigh favorites for equal counts", () => {
    expect(demandScore({ inquiries: 4, savedSearches: 0, watches: 0, favorites: 0 }))
      .toBeGreaterThan(demandScore({ inquiries: 0, savedSearches: 0, watches: 0, favorites: 4 }));
  });
});

describe("opportunityScore", () => {
  it("damps to demand-only when market/margin is unknown", () => {
    expect(opportunityScore({ demandScore: 80, marginPct: null, sampleSize: 0, freshnessDays: null })).toBe(32);
  });
  it("rewards strong demand + healthy margin + fresh, deep market data", () => {
    const s = opportunityScore({ demandScore: 80, marginPct: 25, sampleSize: 10, freshnessDays: 10 });
    expect(s).toBeGreaterThanOrEqual(70);
  });
  it("penalizes thin sample / stale data", () => {
    const fresh = opportunityScore({ demandScore: 60, marginPct: 20, sampleSize: 10, freshnessDays: 5 });
    const stale = opportunityScore({ demandScore: 60, marginPct: 20, sampleSize: 1, freshnessDays: 200 });
    expect(stale).toBeLessThan(fresh);
  });
});

describe("verdict", () => {
  it("skips thin margin regardless of score", () => {
    expect(verdict(90, 3)).toBe("skip");
  });
  it("tiers by score otherwise", () => {
    expect(verdict(75, 20)).toBe("strong_buy");
    expect(verdict(50, 15)).toBe("buy");
    expect(verdict(30, 10)).toBe("consider");
    expect(verdict(10, 10)).toBe("skip");
    expect(verdict(80, null)).toBe("strong_buy"); // unknown margin, strong demand
  });
  it("labels verdicts", () => {
    expect(verdictLabel("strong_buy")).toBe("Strong buy");
  });
});

describe("recommendedQty", () => {
  it("is 0 for thin margin", () => {
    expect(recommendedQty(90, 2)).toBe(0);
  });
  it("scales with demand, clamped 1..6", () => {
    expect(recommendedQty(10, 20)).toBe(1);
    expect(recommendedQty(100, 20)).toBe(5);
    expect(recommendedQty(80, null)).toBe(4);
  });
});
