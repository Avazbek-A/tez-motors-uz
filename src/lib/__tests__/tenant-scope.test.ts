import { describe, it, expect, afterEach } from "vitest";
import { scopeToTenant } from "../tenant-context";

// A minimal query-builder stub recording .eq() calls.
function fakeQuery() {
  const calls: Array<[string, string]> = [];
  const q = {
    calls,
    eq(col: string, val: string) {
      calls.push([col, val]);
      return q;
    },
  };
  return q;
}

const ORIG = process.env.MULTI_TENANT;
afterEach(() => {
  if (ORIG === undefined) delete process.env.MULTI_TENANT;
  else process.env.MULTI_TENANT = ORIG;
});

describe("scopeToTenant", () => {
  it("is a no-op when MULTI_TENANT is off", () => {
    delete process.env.MULTI_TENANT;
    const q = fakeQuery();
    const out = scopeToTenant(q, "tenant-123");
    expect(out).toBe(q);
    expect(q.calls).toHaveLength(0);
  });

  it("filters by tenant_id when MULTI_TENANT=1", () => {
    process.env.MULTI_TENANT = "1";
    const q = fakeQuery();
    scopeToTenant(q, "tenant-123");
    expect(q.calls).toEqual([["tenant_id", "tenant-123"]]);
  });
});
