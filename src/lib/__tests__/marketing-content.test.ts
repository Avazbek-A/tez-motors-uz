import { describe, it, expect } from "vitest";
import {
  CONTENT_KINDS,
  contentKindLabel,
  isContentKind,
  carHeadline,
  subjectText,
  fallbackContent,
} from "../marketing-content";

describe("content kinds", () => {
  it("has unique keys with token budgets + guidance", () => {
    const keys = CONTENT_KINDS.map((k) => k.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of CONTENT_KINDS) {
      expect(k.maxTokens).toBeGreaterThan(0);
      expect(k.guidance.length).toBeGreaterThan(10);
    }
  });
  it("labels and validates", () => {
    expect(contentKindLabel("telegram")).toBe("Telegram post");
    expect(isContentKind("ad")).toBe(true);
    expect(isContentKind("tiktok")).toBe(false);
  });
});

describe("subject helpers", () => {
  it("formats a car headline with price", () => {
    expect(carHeadline({ brand: "BYD", model: "Song Plus", year: 2024, price_usd: 30000 })).toBe("BYD Song Plus 2024 — $30,000");
  });
  it("builds subject text from a car or a topic", () => {
    expect(subjectText({ car: { brand: "Chery", model: "Tiggo 8", body_type: "suv" } })).toContain("Chery Tiggo 8");
    expect(subjectText({ topic: "  customs in 2026 " })).toBe("customs in 2026");
    expect(subjectText({})).toBe("");
  });
});

describe("fallbackContent", () => {
  it("never returns empty and references the subject", () => {
    const t = fallbackContent("telegram", "ru", { car: { brand: "BYD", model: "Han", year: 2024, price_usd: 40000 } });
    expect(t.length).toBeGreaterThan(10);
    expect(t).toContain("BYD Han");
  });
  it("uses a blog heading for blog kind", () => {
    expect(fallbackContent("blog", "en", { topic: "Importing from China" }).startsWith("#")).toBe(true);
  });
  it("adds hashtags for instagram", () => {
    expect(fallbackContent("instagram", "uz", { topic: "avto" })).toContain("#");
  });
});
