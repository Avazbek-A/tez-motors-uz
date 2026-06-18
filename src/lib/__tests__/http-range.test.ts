import { describe, it, expect } from "vitest";
import { parseRange } from "../http-range";

describe("parseRange", () => {
  const SIZE = 1000;

  it("returns null for an absent header", () => {
    expect(parseRange(null, SIZE)).toBeNull();
    expect(parseRange(undefined, SIZE)).toBeNull();
    expect(parseRange("", SIZE)).toBeNull();
  });

  it("returns null for a malformed header", () => {
    expect(parseRange("megabytes=0-10", SIZE)).toBeNull();
    expect(parseRange("bytes=abc-def", SIZE)).toBeNull();
    expect(parseRange("bytes=-", SIZE)).toBeNull();
    expect(parseRange("bytes=0-10,20-30", SIZE)).toBeNull(); // multi-range unsupported
  });

  it("parses a closed range", () => {
    expect(parseRange("bytes=0-499", SIZE)).toEqual({ start: 0, end: 499 });
    expect(parseRange("bytes=200-799", SIZE)).toEqual({ start: 200, end: 799 });
  });

  it("parses an open-ended range (start to EOF)", () => {
    expect(parseRange("bytes=500-", SIZE)).toEqual({ start: 500, end: 999 });
    expect(parseRange("bytes=0-", SIZE)).toEqual({ start: 0, end: 999 });
  });

  it("parses a suffix range (last N bytes)", () => {
    expect(parseRange("bytes=-100", SIZE)).toEqual({ start: 900, end: 999 });
    // Suffix larger than the file clamps to the whole file.
    expect(parseRange("bytes=-5000", SIZE)).toEqual({ start: 0, end: 999 });
  });

  it("clamps an end past EOF", () => {
    expect(parseRange("bytes=900-99999", SIZE)).toEqual({ start: 900, end: 999 });
  });

  it("returns null for an unsatisfiable range (start past EOF, inverted, negative)", () => {
    expect(parseRange("bytes=1000-1100", SIZE)).toBeNull();
    expect(parseRange("bytes=2000-3000", SIZE)).toBeNull();
    expect(parseRange("bytes=500-400", SIZE)).toBeNull();
  });

  it("returns null when the size is unknown/zero", () => {
    expect(parseRange("bytes=0-10", 0)).toBeNull();
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseRange("  bytes=0-10  ", SIZE)).toEqual({ start: 0, end: 10 });
  });
});
