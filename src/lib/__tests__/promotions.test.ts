import { describe, it, expect } from "vitest";
import { salePrice, discountPct, promoStatusAt } from "../promotions";

describe("salePrice", () => {
  it("applies a percent off, rounded to $100", () => {
    expect(salePrice(30000, { pctOff: 10 })).toBe(27000);
    expect(salePrice(32500, { pctOff: 15 })).toBe(27600); // 27625 → 27600
  });
  it("uses a fixed sale price when given", () => {
    expect(salePrice(30000, { fixedPrice: 28000 })).toBe(28000);
  });
  it("never returns ≥ the original price", () => {
    expect(salePrice(30000, { fixedPrice: 40000 })).toBe(29999);
  });
  it("returns the price unchanged with no discount", () => {
    expect(salePrice(30000, {})).toBe(30000);
  });
  it("caps percent at 90", () => {
    expect(salePrice(10000, { pctOff: 99 })).toBe(1000);
  });
});

describe("discountPct", () => {
  it("computes the discount percent", () => {
    expect(discountPct(30000, 27000)).toBe(10);
  });
  it("is 0 when not a discount", () => {
    expect(discountPct(30000, 30000)).toBe(0);
    expect(discountPct(0, 0)).toBe(0);
  });
});

describe("promoStatusAt", () => {
  const t = (s: string) => Date.parse(s);
  it("is scheduled before the window", () => {
    expect(promoStatusAt("2026-07-01", "2026-07-10", t("2026-06-25"), "scheduled")).toBe("scheduled");
  });
  it("is active inside the window", () => {
    expect(promoStatusAt("2026-07-01", "2026-07-10", t("2026-07-05"), "scheduled")).toBe("active");
  });
  it("ends after the window", () => {
    expect(promoStatusAt("2026-07-01", "2026-07-10", t("2026-07-11"), "active")).toBe("ended");
  });
  it("respects terminal states", () => {
    expect(promoStatusAt("2026-07-01", null, t("2026-07-05"), "cancelled")).toBe("cancelled");
    expect(promoStatusAt("2026-07-01", "2026-07-10", t("2026-07-05"), "ended")).toBe("ended");
  });
});
