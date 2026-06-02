import { describe, it, expect } from "vitest";
import {
  sanitizeSearch,
  parseBudgetCeiling,
  templatedReply,
  toAssistantCarLite,
  historyFromRows,
} from "../assistant-core";
import { priceFromMonthly, estimatedMonthlyFrom } from "../finance";
import type { Car } from "@/types/car";

function fakeCar(over: Partial<Car> = {}): Car {
  return {
    id: "id-1",
    slug: "byd-song-plus-2024",
    brand: "BYD",
    model: "Song Plus",
    year: 2024,
    price_usd: 30000,
    body_type: "suv",
    fuel_type: "hybrid",
    ...(over as object),
  } as Car;
}

describe("sanitizeSearch", () => {
  it("strips search-breaking characters and collapses whitespace", () => {
    expect(sanitizeSearch("  byd%   (song)*  ")).toBe("byd song");
  });
  it("caps length at 64 chars", () => {
    expect(sanitizeSearch("a".repeat(100)).length).toBe(64);
  });
});

describe("parseBudgetCeiling", () => {
  it("parses 'under $30k' to 30000", () => {
    expect(parseBudgetCeiling("family suv under $30k")).toBe(30000);
  });
  it("parses a plain large number ('до 25000')", () => {
    expect(parseBudgetCeiling("до 25000")).toBe(25000);
  });
  it("parses spaced thousands ('30 000')", () => {
    expect(parseBudgetCeiling("бюджет 30 000")).toBe(30000);
  });
  it("parses a monthly budget via PMT inversion ('$500/mo')", () => {
    expect(parseBudgetCeiling("around $500/mo")).toBe(Math.floor(priceFromMonthly(500)));
  });
  it("parses an Uzbek monthly budget ('800 oylik')", () => {
    expect(parseBudgetCeiling("800 oylik to'lov")).toBe(Math.floor(priceFromMonthly(800)));
  });
  it("returns null with no usable number", () => {
    expect(parseBudgetCeiling("семейный кроссовер с большим багажником")).toBeNull();
  });
  it("ignores numbers below the 3000 floor", () => {
    expect(parseBudgetCeiling("need 200 horsepower")).toBeNull();
  });
});

describe("templatedReply", () => {
  it("invites a callback when nothing is in stock", () => {
    expect(templatedReply("ru", [])).toContain("менеджер");
    expect(templatedReply("uz", [])).toContain("menejer");
    expect(templatedReply("en", [])).toContain("manager");
  });
  it("names real cars and prices when stock exists", () => {
    const reply = templatedReply("en", [fakeCar()]);
    expect(reply).toContain("BYD Song Plus 2024");
    expect(reply).toContain("$30,000");
  });
});

describe("toAssistantCarLite", () => {
  it("projects the lean shape with a computed monthly", () => {
    const [lite] = toAssistantCarLite([fakeCar({ price_usd: 30000 })]);
    expect(lite).toEqual({
      brand: "BYD",
      model: "Song Plus",
      year: 2024,
      price_usd: 30000,
      monthly_usd: estimatedMonthlyFrom(30000),
      body_type: "suv",
      fuel_type: "hybrid",
    });
  });
});

describe("historyFromRows", () => {
  it("maps rows to turns, preserving order", () => {
    const turns = historyFromRows([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
    expect(turns).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
  });

  it("keeps only the last `max` turns", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
    const turns = historyFromRows(rows, 4);
    expect(turns).toHaveLength(4);
    expect(turns[0].content).toBe("m6");
    expect(turns[3].content).toBe("m9");
  });

  it("coerces unknown roles to user and drops empty content", () => {
    const turns = historyFromRows([
      { role: "system", content: "x" },
      { role: "assistant", content: "" },
      { role: null, content: "y" },
    ]);
    expect(turns).toEqual([
      { role: "user", content: "x" },
      { role: "user", content: "y" },
    ]);
  });
});
