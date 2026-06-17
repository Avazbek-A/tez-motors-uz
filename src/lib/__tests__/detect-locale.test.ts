import { describe, it, expect } from "vitest";
import { detectMessageLocale, resolveReplyLocale } from "../detect-locale";

describe("detectMessageLocale", () => {
  it("detects Russian from Cyrillic (the reported bug)", () => {
    expect(detectMessageLocale("привет")).toBe("ru");
    expect(detectMessageLocale("слишком дешево. мне нужна дорогая хорошая машина")).toBe("ru");
    expect(detectMessageLocale("Здравствуйте, есть ли BYD Han в наличии?")).toBe("ru");
  });

  it("detects Uzbek from Latin markers / words", () => {
    expect(detectMessageLocale("Assalomu alaykum, narxi qancha?")).toBe("uz");
    expect(detectMessageLocale("menga arzon mashina kerak")).toBe("uz");
    expect(detectMessageLocale("BYD bormi, oyiga qancha to'lov?")).toBe("uz");
  });

  it("detects English from common words", () => {
    expect(detectMessageLocale("Hello, do you have this car in stock?")).toBe("en");
    expect(detectMessageLocale("what is the monthly payment")).toBe("en");
  });

  it("returns null when undecidable (digits / emoji / bare model)", () => {
    expect(detectMessageLocale("123456")).toBeNull();
    expect(detectMessageLocale("👍🚗")).toBeNull();
    expect(detectMessageLocale("")).toBeNull();
    expect(detectMessageLocale(null)).toBeNull();
  });

  it("ignores URLs when weighing scripts", () => {
    // A Russian message that happens to paste a Latin URL is still Russian.
    expect(detectMessageLocale("посмотрите https://example.com/byd-han цена?")).toBe("ru");
  });

  it("resolveReplyLocale falls back when undecidable", () => {
    expect(resolveReplyLocale("123", "ru")).toBe("ru");
    expect(resolveReplyLocale("привет", "en")).toBe("ru"); // detection wins over fallback
    expect(resolveReplyLocale("Hello there", "ru")).toBe("en");
  });
});
