import { describe, it, expect } from "vitest";
import { isUuid, parseUuidList } from "@/lib/uuid";
import { PUBLIC_CAR_COLUMNS, PUBLIC_CAR_LIST_COLUMNS } from "@/lib/car-columns";

describe("isUuid", () => {
  it("accepts a real uuid in either case", () => {
    expect(isUuid("3f1c9d2e-6b4a-4c3d-9e21-7a5b8c0d1e2f")).toBe(true);
    expect(isUuid("3F1C9D2E-6B4A-4C3D-9E21-7A5B8C0D1E2F")).toBe(true);
  });

  it("rejects the stale numeric ids that used to reach Postgres as uuid", () => {
    // These all passed the old /^[a-f0-9-]{1,64}$/i guard and produced 22P02.
    for (const bad of ["8", "abc", "----", "12345678-1234-1234-1234-12345678901"]) {
      expect(isUuid(bad)).toBe(false);
    }
  });
});

describe("parseUuidList", () => {
  const a = "3f1c9d2e-6b4a-4c3d-9e21-7a5b8c0d1e2f";
  const b = "9c8b7a65-4321-4dcb-8a90-0f1e2d3c4b5a";

  it("keeps valid ids, drops junk, de-dupes and lowercases", () => {
    expect(parseUuidList(` ${a}, 8 ,${a.toUpperCase()}, ${b} `)).toEqual([a, b]);
  });

  it("returns an empty list for null or all-invalid input", () => {
    expect(parseUuidList(null)).toEqual([]);
    expect(parseUuidList("8,9,10")).toEqual([]);
  });

  it("caps the list", () => {
    expect(parseUuidList(Array.from({ length: 50 }, (_, i) => a.slice(0, -1) + i.toString(16).slice(-1)).join(","), 3)).toHaveLength(3);
  });
});

describe("PUBLIC_CAR_LIST_COLUMNS", () => {
  it("drops spec_data — the jsonb that timed out the list query", () => {
    expect(PUBLIC_CAR_LIST_COLUMNS.split(", ")).not.toContain("spec_data");
    expect(PUBLIC_CAR_COLUMNS.split(", ")).toContain("spec_data");
  });

  it("is a subset of what we are willing to publish", () => {
    const full = new Set(PUBLIC_CAR_COLUMNS.split(", "));
    for (const col of PUBLIC_CAR_LIST_COLUMNS.split(", ")) expect(full.has(col)).toBe(true);
  });

  it("still carries what a card renders", () => {
    for (const col of ["id", "slug", "brand", "model", "price_usd", "thumbnail", "images"]) {
      expect(PUBLIC_CAR_LIST_COLUMNS.split(", ")).toContain(col);
    }
  });
});
