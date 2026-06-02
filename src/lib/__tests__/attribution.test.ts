import { describe, it, expect } from "vitest";
import { attributionFromParams, parseAttributionCookie, attributionLabel } from "../attribution";

describe("attributionFromParams", () => {
  it("captures UTM params + referrer", () => {
    expect(attributionFromParams("?utm_source=instagram&utm_medium=social&utm_campaign=byd_may", "https://t.me/x")).toEqual({
      source: "instagram", medium: "social", campaign: "byd_may", referrer: "https://t.me/x",
    });
  });
  it("returns null when there is nothing", () => {
    expect(attributionFromParams("?foo=bar", null)).toBeNull();
    expect(attributionFromParams("", "")).toBeNull();
  });
  it("keeps a referrer-only signal", () => {
    expect(attributionFromParams("", "https://google.com")).toEqual({ referrer: "https://google.com" });
  });
});

describe("parseAttributionCookie", () => {
  it("round-trips a stored object", () => {
    const raw = JSON.stringify({ source: "telegram", campaign: "spring" });
    expect(parseAttributionCookie(raw)).toEqual({ source: "telegram", campaign: "spring" });
  });
  it("rejects junk / empty", () => {
    expect(parseAttributionCookie("not json")).toBeNull();
    expect(parseAttributionCookie(JSON.stringify({ foo: 1 }))).toBeNull();
    expect(parseAttributionCookie(null)).toBeNull();
  });
});

describe("attributionLabel", () => {
  it("prefers source, then referrer host, then direct", () => {
    expect(attributionLabel({ source: "Instagram" })).toBe("instagram");
    expect(attributionLabel({ referrer: "https://www.google.com/search" })).toBe("google.com");
    expect(attributionLabel(null)).toBe("direct");
    expect(attributionLabel({})).toBe("direct");
  });
});
