import { describe, it, expect } from "vitest";
import { parseRfqText } from "../rfq-parse";

describe("parseRfqText", () => {
  it("extracts CNY price, lead time (weeks→days), and MOQ", () => {
    const r = parseRfqText("BYD Song Plus, 85,000 RMB per unit, MOQ 5, lead time 6 weeks");
    expect(r.priceCny).toBe(85000);
    expect(r.moq).toBe(5);
    expect(r.leadTimeDays).toBe(42);
  });

  it("extracts USD price and days", () => {
    const r = parseRfqText("Price: $12,500 USD. Minimum order 3 units. 30 days production.");
    expect(r.priceUsd).toBe(12500);
    expect(r.moq).toBe(3);
    expect(r.leadTimeDays).toBe(30);
  });

  it("handles the ¥ symbol and 元", () => {
    expect(parseRfqText("报价 ¥98000 元").priceCny).toBe(98000);
  });

  it("returns nulls for an unparseable string", () => {
    const r = parseRfqText("hello, can you send a catalogue?");
    expect(r).toEqual({ priceUsd: null, priceCny: null, leadTimeDays: null, moq: null });
  });

  it("prefers weeks for lead time when both forms could match", () => {
    expect(parseRfqText("lead time 8 weeks").leadTimeDays).toBe(56);
  });
});
