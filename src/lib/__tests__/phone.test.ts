import { describe, it, expect } from "vitest";
import { loosePhone, canonicalPhone } from "../phone";

describe("loosePhone (compare-friendly whitespace strip)", () => {
  it("strips spaces / dashes / parens — preserves digits, plus, country code", () => {
    expect(loosePhone("+998 90 123-45-67")).toBe("+998901234567");
    expect(loosePhone("(998) 90 1234567")).toBe("998901234567");
    expect(loosePhone("90-12-34-567")).toBe("9012-34-567".replace(/-/g, "")); // sanity
    expect(loosePhone("90-12-34-567")).toBe("90123-4567".replace(/-/g, ""));
  });
  it("handles null / undefined / empty", () => {
    expect(loosePhone(null)).toBe("");
    expect(loosePhone(undefined)).toBe("");
    expect(loosePhone("")).toBe("");
  });
});

describe("canonicalPhone (strict UZ canonicalization)", () => {
  it("normalizes a 9-digit national to +998XXXXXXXXX", () => {
    expect(canonicalPhone("901234567")).toBe("+998901234567");
    expect(canonicalPhone("+998901234567")).toBe("+998901234567");
    expect(canonicalPhone("(90) 123-45-67")).toBe("+998901234567");
    expect(canonicalPhone("0901234567")).toBe("+998901234567"); // trunk 0
  });
  it("returns null for non-9-digit garbage", () => {
    expect(canonicalPhone("12345")).toBeNull();
    expect(canonicalPhone("")).toBeNull();
    expect(canonicalPhone("not a number")).toBeNull();
  });
});
