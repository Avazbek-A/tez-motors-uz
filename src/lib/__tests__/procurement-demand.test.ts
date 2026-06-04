import { describe, it, expect } from "vitest";
import { modelKey, isDepositedStatus } from "../procurement-demand";
import { demandScore } from "../buying-brain";

describe("modelKey", () => {
  it("lowercases and pipe-joins brand|model (matches the buying route)", () => {
    expect(modelKey("BYD", "Song Plus")).toBe("byd|song plus");
    expect(modelKey("Chery", "Tiggo 8")).toBe("chery|tiggo 8");
  });
});

describe("isDepositedStatus", () => {
  it("treats deposit_paid and beyond as deposited; 'ordered' is not", () => {
    expect(isDepositedStatus("ordered")).toBe(false);
    expect(isDepositedStatus("deposit_paid")).toBe(true);
    expect(isDepositedStatus("sourcing")).toBe(true);
    expect(isDepositedStatus("delivered")).toBe(true);
    expect(isDepositedStatus("nonsense")).toBe(false);
  });
});

describe("demandScore with pre-orders", () => {
  const base = { inquiries: 0, watches: 0, favorites: 0, savedSearches: 0 };

  it("a deposited pre-order weighs more than an inquiry", () => {
    const oneInquiry = demandScore({ ...base, inquiries: 1 });
    const oneDeposited = demandScore({ ...base, preordersTotal: 1, preordersDeposited: 1 });
    expect(oneDeposited).toBeGreaterThan(oneInquiry);
  });

  it("a deposited pre-order weighs more than an un-deposited one", () => {
    const pending = demandScore({ ...base, preordersTotal: 1, preordersDeposited: 0 });
    const deposited = demandScore({ ...base, preordersTotal: 1, preordersDeposited: 1 });
    expect(deposited).toBeGreaterThan(pending);
  });

  it("clamps deposited to total and ignores negatives", () => {
    // deposited > total is clamped to total; negative inputs floored at 0.
    const a = demandScore({ ...base, preordersTotal: 2, preordersDeposited: 5 });
    const b = demandScore({ ...base, preordersTotal: 2, preordersDeposited: 2 });
    expect(a).toBe(b);
    expect(demandScore({ ...base, preordersTotal: -3, preordersDeposited: -1 })).toBe(0);
  });

  it("is backward-compatible when pre-order fields are absent", () => {
    expect(demandScore({ ...base, inquiries: 3 })).toBe(demandScore({ inquiries: 3, watches: 0, favorites: 0, savedSearches: 0 }));
  });
});
