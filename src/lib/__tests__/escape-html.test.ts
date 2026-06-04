import { describe, it, expect } from "vitest";
import { escapeHtml } from "../escape-html";

describe("escapeHtml", () => {
  it("escapes the five HTML metacharacters", () => {
    expect(escapeHtml("&<>\"'")).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("renders nothing for null/undefined (gracefully)", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("coerces non-string values via String()", () => {
    expect(escapeHtml(42)).toBe("42");
    expect(escapeHtml(true)).toBe("true");
    expect(escapeHtml({ toString: () => "<x>" })).toBe("&lt;x&gt;");
  });

  it("neutralises a script tag (the practical case)", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes BOTH single and double quotes (safe in attribute contexts)", () => {
    // 3-char locals (some originals) escaped only & < >; that's unsafe inside
    // double-quoted attributes if the value contains a quote. The unified
    // helper escapes both kinds.
    expect(escapeHtml(`a"b`)).toBe("a&quot;b");
    expect(escapeHtml(`a'b`)).toBe("a&#39;b");
  });

  it("escapes & FIRST so existing entities don't double-encode oddly", () => {
    // "& < >" → "&amp; &lt; &gt;" (not "&amp;amp;").
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
});
