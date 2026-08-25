import { describe, it, expect } from "vitest";
import {
  suggestMarkdownPct,
  markdownPrice,
  agingSuggestion,
  suggestIncreasePct,
  increasePrice,
  STALE_AFTER_DAYS,
  isBulkImportArtifact,
} from "../inventory-aging";

describe("suggestMarkdownPct", () => {
  it("returns 0 before the stale threshold", () => {
    expect(suggestMarkdownPct(STALE_AFTER_DAYS - 1, 0)).toBe(0);
    expect(suggestMarkdownPct(10, 0)).toBe(0);
  });

  it("escalates the markdown with age", () => {
    expect(suggestMarkdownPct(50, 3)).toBe(4); // 45-89
    expect(suggestMarkdownPct(120, 3)).toBe(8); // 90-179
    expect(suggestMarkdownPct(200, 3)).toBe(12); // 180+
  });

  it("nudges harder when there is zero interest", () => {
    expect(suggestMarkdownPct(50, 0)).toBe(7); // 4 + 3
    expect(suggestMarkdownPct(200, 0)).toBe(15); // 12 + 3
  });

  it("holds price on genuinely wanted stock regardless of age", () => {
    expect(suggestMarkdownPct(300, 8)).toBe(0);
    expect(suggestMarkdownPct(300, 20)).toBe(0);
  });

  it("caps the markdown at 20%", () => {
    expect(suggestMarkdownPct(99999, 0)).toBeLessThanOrEqual(20);
  });
});

describe("markdownPrice", () => {
  it("applies the markdown and floors to the nearest $100", () => {
    expect(markdownPrice(25000, 8)).toBe(23000); // 23000
    expect(markdownPrice(28750, 5)).toBe(27300); // 27312.5 → 27300
  });
  it("returns the price unchanged for a 0% markdown", () => {
    expect(markdownPrice(25000, 0)).toBe(25000);
  });
});

describe("suggestIncreasePct", () => {
  it("only raises fresh stock with strong demand", () => {
    expect(suggestIncreasePct(10, 25)).toBe(5);
    expect(suggestIncreasePct(10, 14)).toBe(3);
    expect(suggestIncreasePct(10, 5)).toBe(0); // weak demand
    expect(suggestIncreasePct(45, 25)).toBe(0); // not fresh
  });
});

describe("increasePrice", () => {
  it("raises the price and ceils to the nearest $100", () => {
    expect(increasePrice(25000, 5)).toBe(26300); // 26250 ceiled to nearest $100
    expect(increasePrice(25000, 0)).toBe(25000);
  });
});

describe("agingSuggestion", () => {
  it("recommends no action for fresh inventory", () => {
    const s = agingSuggestion({ price_usd: 25000, daysOnLot: 10, demandScore: 0 });
    expect(s.markdownPct).toBe(0);
    expect(s.suggestedPriceUsd).toBe(25000);
  });
  it("recommends a marked-down price for cold, aged stock", () => {
    const s = agingSuggestion({ price_usd: 25000, daysOnLot: 120, demandScore: 0 });
    expect(s.markdownPct).toBe(11); // 8 + 3
    expect(s.suggestedPriceUsd).toBeLessThan(25000);
  });
});

describe("isBulkImportArtifact", () => {
  const uniform = (n: number, day: number) => Array.from({ length: n }, () => day);

  it("flags a seeded catalog: one import date, whole fleet marked down", () => {
    // The real case: 586 cars imported the same day, all 70 days old.
    expect(isBulkImportArtifact(uniform(586, 70), 586)).toBe(true);
  });

  it("still alerts when a real lot has genuinely gone cold", () => {
    // Stock that arrived over many months — ages spread out, so the signal means something.
    const spread = Array.from({ length: 100 }, (_, i) => 50 + i * 3);
    expect(isBulkImportArtifact(spread, 100)).toBe(false);
  });

  it("still alerts when only part of the fleet is stale", () => {
    expect(isBulkImportArtifact(uniform(100, 70), 40)).toBe(false);
  });

  it("is safe on an empty fleet", () => {
    expect(isBulkImportArtifact([], 0)).toBe(false);
  });
});
