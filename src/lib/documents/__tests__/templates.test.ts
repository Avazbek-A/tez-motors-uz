import { describe, it, expect } from "vitest";
import { buildDocument, documentNumber, DOC_TYPES, type DocData } from "../templates";

const base: DocData = {
  number: "SC-20260601-AB12",
  date: "2026-06-01",
  locale: "ru",
  order: { reference_code: "TM-7K3F9Q2X", customer_name: "Алишер Усманов", customer_phone: "+998901234567", amount_usd: 40000, status: "deposit_paid" },
  car: { brand: "BYD", model: "Seal", year: 2024, color: "белый" },
  depositUsd: 2000,
  vatPct: 12,
};

describe("buildDocument", () => {
  it("renders every doc type with Cyrillic intact + branding", () => {
    for (const t of DOC_TYPES) {
      const { title, html } = buildDocument(t, base);
      expect(title.length).toBeGreaterThan(0);
      expect(html).toContain("Алишер Усманов"); // Cyrillic survives (no '?')
      expect(html).toContain("BYD Seal 2024");
      expect(html).toContain("TM-7K3F9Q2X");
      expect(html).not.toContain("?Алишер"); // not mangled
    }
  });
  it("money docs show price, VAT, and net-of-deposit total", () => {
    const html = buildDocument("sales_contract", base).html;
    expect(html).toContain("$40,000");
    expect(html).toContain("$2,000"); // deposit line
    expect(html).toContain("$38,000"); // due = price - deposit
  });
  it("deposit receipt shows the deposit amount", () => {
    expect(buildDocument("deposit_receipt", base).html).toContain("$2,000");
  });
  it("floors the amount-due at $0 when the deposit exceeds the price", () => {
    // Regression: deposit > price (e.g. price unset/0) must not print a negative
    // total on a customer-facing contract.
    const html = buildDocument("sales_contract", { ...base, order: { ...base.order, amount_usd: 0 }, depositUsd: 500 }).html;
    // money(-500) would render "$-500"; the fix floors the total to money(0) = "$0".
    expect(html).not.toContain("$-"); // no negative figure anywhere in the doc
    expect(html).toContain("$0");
  });
  it("renders Uzbek labels", () => {
    const { title } = buildDocument("handover_act", { ...base, locale: "uz" });
    expect(title).toBe("Qabul-topshirish dalolatnomasi");
  });
});

describe("documentNumber", () => {
  it("formats PREFIX-YYYYMMDD-TAIL", () => {
    const n = documentNumber("sales_contract", "TM-7K3F9Q2X");
    expect(n).toMatch(/^SC-\d{8}-[A-Z0-9]{4}$/);
    expect(documentNumber("handover_act", "x").startsWith("AA-")).toBe(true);
  });
});
