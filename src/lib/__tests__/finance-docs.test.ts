import { describe, it, expect } from "vitest";
import {
  lineItemsSubtotal,
  computeInvoiceTotals,
  normalizeExpenseToUsd,
  isExpenseCategory,
  EXPENSE_CATEGORIES,
} from "../finance-docs";

describe("invoice totals", () => {
  it("sums line items", () => {
    expect(lineItemsSubtotal([{ description: "a", qty: 2, unitUsd: 100 }, { description: "b", qty: 1, unitUsd: 50.5 }])).toBe(250.5);
  });
  it("adds VAT on top", () => {
    expect(computeInvoiceTotals([{ description: "car", qty: 1, unitUsd: 30000 }], 12)).toEqual({
      subtotalUsd: 30000,
      vatUsd: 3600,
      totalUsd: 33600,
    });
  });
  it("handles zero VAT and empty items", () => {
    expect(computeInvoiceTotals([], 12)).toEqual({ subtotalUsd: 0, vatUsd: 0, totalUsd: 0 });
    expect(computeInvoiceTotals([{ description: "x", qty: 1, unitUsd: 100 }], 0).vatUsd).toBe(0);
  });
  it("clamps negative qty/price", () => {
    expect(lineItemsSubtotal([{ description: "x", qty: -2, unitUsd: 100 }])).toBe(0);
  });
});

describe("normalizeExpenseToUsd", () => {
  const fx = { usd_uzs: 12600, cny_uzs: 1750 };
  it("passes USD through", () => {
    expect(normalizeExpenseToUsd(500, "USD", fx)).toBe(500);
  });
  it("converts UZS → USD", () => {
    expect(normalizeExpenseToUsd(12_600_000, "UZS", fx)).toBe(1000);
  });
  it("converts CNY → USD via UZS", () => {
    // 7200 CNY × 1750 / 12600 = 1000 USD
    expect(normalizeExpenseToUsd(7200, "CNY", fx)).toBe(1000);
  });
  it("is safe when rate is missing", () => {
    expect(normalizeExpenseToUsd(100, "UZS", { usd_uzs: 0, cny_uzs: 0 })).toBe(0);
  });
});

describe("expense categories", () => {
  it("validates known categories", () => {
    expect(isExpenseCategory("supplier_payment")).toBe(true);
    expect(isExpenseCategory("nope")).toBe(false);
    expect(EXPENSE_CATEGORIES).toContain("customs");
  });
});
