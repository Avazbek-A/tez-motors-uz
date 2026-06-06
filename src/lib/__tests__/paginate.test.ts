import { describe, it, expect, vi } from "vitest";
import { fetchAllRows, chunk } from "../supabase/paginate";

describe("chunk", () => {
  it("splits into chunks of at most size, last chunk shorter", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("returns [] for an empty array and never an empty inner chunk", () => {
    expect(chunk([], 3)).toEqual([]);
    expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
  });
  it("treats size < 1 as 1 (no zero-step infinite loop)", () => {
    expect(chunk([1, 2, 3], 0)).toEqual([[1], [2], [3]]);
  });
});

// Build a fake `range` over an in-memory dataset, recording the page requests.
function fakeRange(rows: number[], pageSize = 1000, errorAtFrom?: number) {
  const calls: Array<[number, number]> = [];
  const fn = vi.fn(async (from: number, to: number) => {
    calls.push([from, to]);
    if (errorAtFrom !== undefined && from === errorAtFrom) {
      return { data: null, error: { message: "boom" } as never };
    }
    return { data: rows.slice(from, to + 1), error: null };
  });
  return { fn, calls, pageSize };
}

describe("fetchAllRows", () => {
  it("returns all rows across multiple pages (2500 rows, page 1000)", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => i);
    const { fn, calls } = fakeRange(rows);
    const out = await fetchAllRows<number>(fn, { pageSize: 1000 });
    expect(out).toHaveLength(2500);
    expect(out).toEqual(rows);
    // 0-999, 1000-1999, 2000-2999 (short page of 500 stops the loop)
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("stops with an extra empty page when total is an exact multiple of pageSize", async () => {
    const rows = Array.from({ length: 2000 }, (_, i) => i);
    const { fn, calls } = fakeRange(rows);
    const out = await fetchAllRows<number>(fn, { pageSize: 1000 });
    expect(out).toHaveLength(2000);
    // full, full, then an empty page that ends it
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("returns [] for an empty table (single empty page)", async () => {
    const { fn, calls } = fakeRange([]);
    const out = await fetchAllRows<number>(fn, { pageSize: 1000 });
    expect(out).toEqual([]);
    expect(calls).toEqual([[0, 999]]);
  });

  it("a single short page ends immediately", async () => {
    const rows = [1, 2, 3];
    const { fn, calls } = fakeRange(rows);
    const out = await fetchAllRows<number>(fn, { pageSize: 1000 });
    expect(out).toEqual([1, 2, 3]);
    expect(calls).toEqual([[0, 999]]);
  });

  it("stops on a page error, keeping rows already fetched", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => i);
    const { fn } = fakeRange(rows, 1000, 1000); // error on the 2nd page
    const out = await fetchAllRows<number>(fn, { pageSize: 1000 });
    expect(out).toHaveLength(1000); // only the first page survived
  });

  it("respects the maxRows safety ceiling", async () => {
    // Infinite full pages — must stop at maxRows, not loop forever.
    const fn = vi.fn(async (from: number, to: number) => ({
      data: Array.from({ length: to - from + 1 }, (_, i) => from + i),
      error: null as never,
    }));
    const out = await fetchAllRows<number>(fn, { pageSize: 1000, maxRows: 3000 });
    expect(out).toHaveLength(3000);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
