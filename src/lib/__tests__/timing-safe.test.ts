import { describe, it, expect } from "vitest";
import { timingSafeEqual } from "../timing-safe";

describe("timingSafeEqual", () => {
  it("is true only for identical strings", () => {
    expect(timingSafeEqual("secret-token", "secret-token")).toBe(true);
    expect(timingSafeEqual("secret-token", "secret-tokeN")).toBe(false);
    expect(timingSafeEqual("secret-token", "xecret-token")).toBe(false);
  });
  it("is false for different lengths", () => {
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
    expect(timingSafeEqual("", "x")).toBe(false);
  });
  it("matches empty strings and rejects non-strings", () => {
    expect(timingSafeEqual("", "")).toBe(true);
    // @ts-expect-error runtime guard
    expect(timingSafeEqual(null, "x")).toBe(false);
  });
});
