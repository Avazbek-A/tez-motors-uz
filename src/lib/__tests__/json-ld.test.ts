import { describe, it, expect } from "vitest";
import { jsonLd } from "../json-ld";

describe("jsonLd", () => {
  it("serializes normal objects as JSON", () => {
    expect(jsonLd({ "@type": "Car", name: "BYD Song" })).toBe('{"@type":"Car","name":"BYD Song"}');
  });
  it("escapes < so a value cannot break out of <script>", () => {
    const out = jsonLd({ name: "evil</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c/script>");
  });
  it("stays valid JSON after escaping", () => {
    const out = jsonLd({ name: "a < b </script>" });
    expect(JSON.parse(out).name).toBe("a < b </script>");
  });
});
