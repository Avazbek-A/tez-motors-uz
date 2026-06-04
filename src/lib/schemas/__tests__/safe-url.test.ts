import { describe, it, expect } from "vitest";
import { safeHttpUrl, safeHttpUrlNullable } from "../safe-url";

describe("safeHttpUrl", () => {
  it("accepts http(s) URLs", () => {
    expect(safeHttpUrl.safeParse("https://example.com/img.png").success).toBe(true);
    expect(safeHttpUrl.safeParse("http://example.com/img.png").success).toBe(true);
    expect(safeHttpUrl.safeParse("https://supabase.co/storage/v1/object/public/car-images/2024/x.jpg").success).toBe(true);
  });

  // This is the entire reason this validator exists — z.string().url() accepts
  // these and they're DOM-XSS when rendered as <a href> / <img src>.
  it("REJECTS javascript: data: file: and other dangerous schemes", () => {
    expect(safeHttpUrl.safeParse("javascript:alert(1)").success).toBe(false);
    expect(safeHttpUrl.safeParse("data:text/html,<script>alert(1)</script>").success).toBe(false);
    expect(safeHttpUrl.safeParse("data:image/svg+xml,<svg onload=alert(1)/>").success).toBe(false);
    expect(safeHttpUrl.safeParse("file:///etc/passwd").success).toBe(false);
    expect(safeHttpUrl.safeParse("vbscript:msgbox(1)").success).toBe(false);
    expect(safeHttpUrl.safeParse("gopher://x.example/").success).toBe(false);
    expect(safeHttpUrl.safeParse("ftp://x.example/").success).toBe(false);
  });

  it("REJECTS garbage / non-URL strings", () => {
    expect(safeHttpUrl.safeParse("not a url").success).toBe(false);
    expect(safeHttpUrl.safeParse("").success).toBe(false);
  });

  it("caps length at 2000 chars to bound DB writes", () => {
    const huge = "https://example.com/" + "x".repeat(2100);
    expect(safeHttpUrl.safeParse(huge).success).toBe(false);
  });

  it("safeHttpUrlNullable accepts null/undefined/omitted but still rejects dangerous schemes", () => {
    expect(safeHttpUrlNullable.safeParse(null).success).toBe(true);
    expect(safeHttpUrlNullable.safeParse(undefined).success).toBe(true);
    expect(safeHttpUrlNullable.safeParse("https://example.com/").success).toBe(true);
    expect(safeHttpUrlNullable.safeParse("javascript:alert(1)").success).toBe(false);
  });
});
