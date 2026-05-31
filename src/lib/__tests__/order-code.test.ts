import { describe, it, expect } from "vitest";
import { generateReferenceCode, normalizeReferenceCode } from "../order-code";

describe("order-code", () => {
  it("formats as TM- + 8 unambiguous chars", () => {
    const code = generateReferenceCode();
    expect(code).toMatch(/^TM-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    expect(code.length).toBe(11);
  });

  it("never emits ambiguous characters (0/O, 1/I)", () => {
    for (let i = 0; i < 200; i++) {
      const body = generateReferenceCode().slice(3);
      expect(body).not.toMatch(/[01OI]/);
    }
  });

  it("is effectively collision-free across many draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(generateReferenceCode());
    expect(seen.size).toBe(2000);
  });

  it("normalizes user-typed codes (uppercase, trim, strip spaces)", () => {
    expect(normalizeReferenceCode("  tm-7k3f 9q2x ")).toBe("TM-7K3F9Q2X");
    expect(normalizeReferenceCode("tm-abcd2345")).toBe("TM-ABCD2345");
  });
});
