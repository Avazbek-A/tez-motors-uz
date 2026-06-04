import { describe, it, expect } from "vitest";
import { sanitizePostgrestSearchTerm } from "../search-safe";

describe("sanitizePostgrestSearchTerm", () => {
  it("strips PostgREST-meaningful characters (, ( ) \\ % *)", () => {
    expect(sanitizePostgrestSearchTerm("byd, model.eq.x")).toBe("byd model.eq.x");
    expect(sanitizePostgrestSearchTerm("foo (bar)")).toBe("foo bar");
    expect(sanitizePostgrestSearchTerm("a%b*c\\d")).toBe("abcd");
  });

  it("preserves regular search terms unchanged", () => {
    expect(sanitizePostgrestSearchTerm("BYD Song")).toBe("BYD Song");
    expect(sanitizePostgrestSearchTerm("tiggo-8")).toBe("tiggo-8");
  });

  it("caps the term at 64 characters", () => {
    const long = "a".repeat(200);
    expect(sanitizePostgrestSearchTerm(long).length).toBe(64);
  });

  it("treats empty / short input correctly", () => {
    expect(sanitizePostgrestSearchTerm("")).toBe("");
    expect(sanitizePostgrestSearchTerm("a")).toBe("a");
  });
});
