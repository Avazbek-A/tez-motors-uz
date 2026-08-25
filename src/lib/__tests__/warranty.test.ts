import { describe, it, expect } from "vitest";
import { warrantyUntil, warrantyStatus, daysLeft, totalServiceCost } from "../warranty";

describe("warrantyUntil", () => {
  it("adds months to the delivery date", () => {
    expect(warrantyUntil("2026-01-15", 12)).toBe("2027-01-15");
    expect(warrantyUntil("2026-11-30", 3)).toBe("2027-03-02"); // Feb 30 overflows to Mar 2 (UTC)
  });
  it("returns null without a date or term", () => {
    expect(warrantyUntil(null, 12)).toBeNull();
    expect(warrantyUntil("2026-01-01", 0)).toBeNull();
    expect(warrantyUntil("nope", 12)).toBeNull();
  });
});

describe("warrantyStatus", () => {
  const now = Date.parse("2026-06-01T00:00:00Z");
  it("classifies active / expiring / expired / none", () => {
    expect(warrantyStatus("2026-12-01", now)).toBe("active");
    expect(warrantyStatus("2026-06-20", now)).toBe("expiring"); // within 30d
    expect(warrantyStatus("2026-05-01", now)).toBe("expired");
    expect(warrantyStatus(null, now)).toBe("none");
  });
  it("is still valid (not 'expired') during the whole of its final day", () => {
    // Regression: a warranty expiring today must not flip to 'expired' in the
    // morning of that day (UTC-midnight expiry vs a positive-offset local now).
    const middayOfExpiry = Date.parse("2026-06-06T08:00:00Z"); // ~13:00 in UTC+5
    expect(warrantyStatus("2026-06-06", middayOfExpiry)).toBe("expiring");
    // The day after is expired.
    expect(warrantyStatus("2026-06-06", Date.parse("2026-06-07T08:00:00Z"))).toBe("expired");
  });
});

describe("daysLeft", () => {
  const now = Date.parse("2026-06-01T00:00:00Z");
  it("computes days remaining (negative when expired)", () => {
    expect(daysLeft("2026-06-11", now)).toBe(10);
    expect(daysLeft("2026-05-22", now)).toBe(-10);
    expect(daysLeft(null, now)).toBeNull();
  });
});

describe("totalServiceCost", () => {
  it("sums service costs", () => {
    expect(totalServiceCost([{ date: "x", description: "a", cost_usd: 100 }, { date: "y", description: "b", cost_usd: 50 }])).toBe(150);
    expect(totalServiceCost([])).toBe(0);
    expect(totalServiceCost(null)).toBe(0);
  });
});
