import { describe, it, expect } from "vitest";
import { parseCsv, parseCsvToObjects, csvCell, buildCsv } from "../csv";

describe("csvCell", () => {
  it("leaves plain values unquoted", () => {
    expect(csvCell("BYD")).toBe("BYD");
  });
  it("quotes and escapes commas, quotes, newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("buildCsv", () => {
  it("builds a header + rows with CRLF", () => {
    const csv = buildCsv(["name", "price"], [{ name: "BYD Song", price: 30000 }, { name: "A, B", price: 1 }]);
    expect(csv).toBe('name,price\r\nBYD Song,30000\r\n"A, B",1\r\n');
  });
  it("renders null/undefined as empty", () => {
    expect(buildCsv(["a", "b"], [{ a: null, b: undefined }])).toBe("a,b\r\n,\r\n");
  });
});

describe("parseCsv", () => {
  it("parses quoted fields with commas, newlines and escaped quotes", () => {
    const rows = parseCsv('name,note\r\n"A, B","he said ""hi"""\r\n"multi\nline",x\r\n');
    expect(rows[0]).toEqual(["name", "note"]);
    expect(rows[1]).toEqual(["A, B", 'he said "hi"']);
    expect(rows[2]).toEqual(["multi\nline", "x"]);
  });
  it("handles LF-only and a missing trailing newline", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("parseCsvToObjects", () => {
  it("keys rows by lowercased trimmed headers", () => {
    const objs = parseCsvToObjects("Brand, Model\r\nBYD, Song\r\n");
    expect(objs).toEqual([{ brand: "BYD", model: "Song" }]);
  });
});

describe("round-trip", () => {
  it("buildCsv → parseCsv recovers values incl. tricky ones", () => {
    const rows = [{ a: "x,y", b: 'q"q', c: "n\nl" }];
    const parsed = parseCsv(buildCsv(["a", "b", "c"], rows));
    expect(parsed[1]).toEqual(["x,y", 'q"q', "n\nl"]);
  });
});
