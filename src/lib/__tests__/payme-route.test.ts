/**
 * Integration tests for the Payme JSON-RPC merchant endpoint
 * (src/app/api/payments/payme/route.ts). Payme's sandbox asserts exact behavior
 * across the six methods, so this exercises the real route handler against an
 * in-memory fake Supabase — the money chokepoint that V5 set out to cover:
 *   - wrong Basic auth → -32504 (ships dark / fails closed)
 *   - amount mismatch → -31001, unknown order → -31050
 *   - idempotent double-CreateTransaction → same transaction row
 *   - idempotent double-PerformTransaction → no double deposit (one order event)
 *   - cancel state machine (-1 before perform, -2 after)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { PAYME_STATE, PAYME_ERROR } from "../payme";

// ---- In-memory fake Supabase (hoisted so vi.mock can reference it) ----------
const h = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const store: { tables: Record<string, Row[]>; seq: number } = { tables: {}, seq: 0 };

  function reset() {
    store.tables = {
      orders: [],
      payments: [],
      order_events: [],
      customers: [],
      push_subscriptions: [],
    };
    store.seq = 0;
  }

  class Query {
    table: string;
    op: "select" | "insert" | "update" | "delete" = "select";
    filters: Array<[string, unknown]> = [];
    ranges: Array<["gte" | "lte", string, number]> = [];
    payload: Row | null = null;
    selectAfter = false;
    orderCol: string | null = null;
    orderAsc = true;
    limitN: number | null = null;
    _done = false;
    _result: { data: unknown; error: unknown } = { data: null, error: null };
    _rows: Row[] = [];

    constructor(table: string) {
      this.table = table;
    }

    select(_cols?: string) {
      if (this.op !== "select") this.selectAfter = true;
      return this;
    }
    insert(payload: Row) {
      this.op = "insert";
      this.payload = payload;
      return this;
    }
    update(payload: Row) {
      this.op = "update";
      this.payload = payload;
      return this;
    }
    delete() {
      this.op = "delete";
      return this;
    }
    eq(col: string, val: unknown) {
      this.filters.push([col, val]);
      return this;
    }
    gte(col: string, val: number) {
      this.ranges.push(["gte", col, val]);
      return this;
    }
    lte(col: string, val: number) {
      this.ranges.push(["lte", col, val]);
      return this;
    }
    order(col: string, opts?: { ascending?: boolean }) {
      this.orderCol = col;
      this.orderAsc = opts?.ascending ?? true;
      return this;
    }
    limit(n: number) {
      this.limitN = n;
      return this;
    }

    _matches(r: Row) {
      for (const [c, v] of this.filters) if (r[c] !== v) return false;
      for (const [kind, c, v] of this.ranges) {
        const cell = r[c] as number;
        if (kind === "gte" && !(cell >= v)) return false;
        if (kind === "lte" && !(cell <= v)) return false;
      }
      return true;
    }

    _exec() {
      if (this._done) return this._result;
      this._done = true;
      const rows = store.tables[this.table] || (store.tables[this.table] = []);

      if (this.op === "insert") {
        const row: Row = { id: `row-${++store.seq}`, ...this.payload };
        const dup =
          this.table === "payments" &&
          rows.some((r) => r.payme_transaction_id === row.payme_transaction_id);
        if (dup) {
          this._result = { data: null, error: { code: "23505", message: "duplicate key" } };
          this._rows = [];
        } else {
          rows.push(row);
          this._rows = [row];
          this._result = { data: this.selectAfter ? row : null, error: null };
        }
      } else if (this.op === "update") {
        const matched = rows.filter((r) => this._matches(r));
        for (const r of matched) Object.assign(r, this.payload);
        this._rows = matched;
        this._result = { data: null, error: null };
      } else if (this.op === "delete") {
        const keep: Row[] = [];
        const removed: Row[] = [];
        for (const r of rows) (this._matches(r) ? removed : keep).push(r);
        store.tables[this.table] = keep;
        this._rows = removed;
        this._result = { data: null, error: null };
      } else {
        let res = rows.filter((r) => this._matches(r));
        if (this.orderCol) {
          const c = this.orderCol;
          const dir = this.orderAsc ? 1 : -1;
          res = [...res].sort((x, y) => {
            const xv = x[c] as number;
            const yv = y[c] as number;
            return (xv < yv ? -1 : xv > yv ? 1 : 0) * dir;
          });
        }
        if (this.limitN != null) res = res.slice(0, this.limitN);
        this._rows = res;
        this._result = { data: res, error: null };
      }
      return this._result;
    }

    maybeSingle() {
      this._exec();
      return Promise.resolve({ data: this._rows[0] ?? null, error: this._result.error });
    }
    single() {
      this._exec();
      if (this._rows.length === 0) {
        return Promise.resolve({ data: null, error: this._result.error ?? { message: "no rows" } });
      }
      return Promise.resolve({ data: this._rows[0], error: this._result.error });
    }
    then(resolve: (v: { data: unknown; error: unknown }) => unknown) {
      return Promise.resolve(this._exec()).then(resolve);
    }
  }

  function createServiceClient() {
    return { from: (t: string) => new Query(t) };
  }

  return { store, reset, createServiceClient };
});

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: h.createServiceClient }));
vi.mock("@/lib/order-status", () => ({ notifyOrderStatus: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/error-report", () => ({ logEvent: vi.fn() }));

import { POST } from "@/app/api/payments/payme/route";

// ---- Helpers ----------------------------------------------------------------
const AUTH = "Basic " + Buffer.from("Paycom:test-key").toString("base64");
const ORDER_ID = "order-1";
const DEPOSIT = 630_000_000; // $500 @ 12,600 UZS in tiyin

async function rpc(
  method: string,
  params: Record<string, unknown>,
  opts: { auth?: string; id?: unknown } = {},
) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.auth !== null) headers.authorization = opts.auth ?? AUTH;
  const req = new NextRequest("https://tezmotors.uz/api/payments/payme", {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: opts.id ?? 1 }),
  });
  const res = await POST(req);
  return (await res.json()) as { result?: Record<string, unknown>; error?: { code: number } };
}

const account = { order_id: ORDER_ID };

beforeEach(() => {
  h.reset();
  process.env.PAYME_MERCHANT_KEY = "test-key";
  h.store.tables.orders.push({
    id: ORDER_ID,
    deposit_amount_tiyin: DEPOSIT,
    status: "ordered",
    reference_code: "TM-TEST",
    customer_email: null,
    customer_phone: "+998901234567",
    locale: "ru",
  });
});

afterEach(() => {
  delete process.env.PAYME_MERCHANT_KEY;
  vi.clearAllMocks();
});

// ---- Auth -------------------------------------------------------------------
describe("payme route auth", () => {
  it("rejects a wrong merchant key with -32504", async () => {
    const wrong = "Basic " + Buffer.from("Paycom:nope").toString("base64");
    const res = await rpc("CheckPerformTransaction", { account, amount: DEPOSIT }, { auth: wrong });
    expect(res.error?.code).toBe(PAYME_ERROR.INSUFFICIENT_PRIVILEGE);
  });

  it("rejects a missing auth header with -32504", async () => {
    const res = await rpc("CheckPerformTransaction", { account, amount: DEPOSIT }, { auth: null as unknown as string });
    expect(res.error?.code).toBe(PAYME_ERROR.INSUFFICIENT_PRIVILEGE);
  });
});

// ---- CheckPerformTransaction -----------------------------------------------
describe("CheckPerformTransaction", () => {
  it("allows a valid order + amount", async () => {
    const res = await rpc("CheckPerformTransaction", { account, amount: DEPOSIT });
    expect(res.result).toEqual({ allow: true });
  });

  it("rejects an amount mismatch with -31001", async () => {
    const res = await rpc("CheckPerformTransaction", { account, amount: DEPOSIT + 1 });
    expect(res.error?.code).toBe(PAYME_ERROR.INVALID_AMOUNT);
  });

  it("rejects an unknown order with -31050", async () => {
    const res = await rpc("CheckPerformTransaction", { account: { order_id: "missing" }, amount: DEPOSIT });
    expect(res.error?.code).toBe(PAYME_ERROR.ORDER_NOT_FOUND);
  });
});

// ---- CreateTransaction ------------------------------------------------------
describe("CreateTransaction", () => {
  it("creates a transaction in the CREATED state", async () => {
    const res = await rpc("CreateTransaction", { id: "ptx-1", time: 1_700_000_000_000, account, amount: DEPOSIT });
    expect(res.result?.state).toBe(PAYME_STATE.CREATED);
    expect(res.result?.transaction).toBeTruthy();
    expect(h.store.tables.payments).toHaveLength(1);
  });

  it("is idempotent: a re-sent CreateTransaction returns the same row", async () => {
    const first = await rpc("CreateTransaction", { id: "ptx-1", time: 1, account, amount: DEPOSIT });
    const second = await rpc("CreateTransaction", { id: "ptx-1", time: 1, account, amount: DEPOSIT });
    expect(second.result?.transaction).toBe(first.result?.transaction);
    expect(second.result?.state).toBe(PAYME_STATE.CREATED);
    expect(h.store.tables.payments).toHaveLength(1);
  });

  it("rejects a second pending transaction for the same order (-31051)", async () => {
    await rpc("CreateTransaction", { id: "ptx-1", time: 1, account, amount: DEPOSIT });
    const res = await rpc("CreateTransaction", { id: "ptx-2", time: 2, account, amount: DEPOSIT });
    expect(res.error?.code).toBe(PAYME_ERROR.ORDER_BUSY);
  });

  it("rejects an amount mismatch with -31001", async () => {
    const res = await rpc("CreateTransaction", { id: "ptx-x", time: 1, account, amount: 1 });
    expect(res.error?.code).toBe(PAYME_ERROR.INVALID_AMOUNT);
  });
});

// ---- PerformTransaction -----------------------------------------------------
describe("PerformTransaction", () => {
  it("performs a created transaction and advances the order once", async () => {
    await rpc("CreateTransaction", { id: "ptx-1", time: 1, account, amount: DEPOSIT });
    const res = await rpc("PerformTransaction", { id: "ptx-1" });
    expect(res.result?.state).toBe(PAYME_STATE.PERFORMED);

    const order = h.store.tables.orders[0];
    expect(order.status).toBe("deposit_paid");
    const depositEvents = h.store.tables.order_events.filter((e) => e.status === "deposit_paid");
    expect(depositEvents).toHaveLength(1);
  });

  it("is idempotent: double-Perform does not charge twice", async () => {
    await rpc("CreateTransaction", { id: "ptx-1", time: 1, account, amount: DEPOSIT });
    const first = await rpc("PerformTransaction", { id: "ptx-1" });
    const second = await rpc("PerformTransaction", { id: "ptx-1" });
    expect(second.result?.state).toBe(PAYME_STATE.PERFORMED);
    expect(second.result?.transaction).toBe(first.result?.transaction);
    // Still exactly one deposit_paid event — the second perform was a no-op.
    const depositEvents = h.store.tables.order_events.filter((e) => e.status === "deposit_paid");
    expect(depositEvents).toHaveLength(1);
  });

  it("rejects an unknown transaction with -31003", async () => {
    const res = await rpc("PerformTransaction", { id: "does-not-exist" });
    expect(res.error?.code).toBe(PAYME_ERROR.TRANSACTION_NOT_FOUND);
  });
});

// ---- CancelTransaction ------------------------------------------------------
describe("CancelTransaction", () => {
  it("cancels a created transaction to state -1", async () => {
    await rpc("CreateTransaction", { id: "ptx-1", time: 1, account, amount: DEPOSIT });
    const res = await rpc("CancelTransaction", { id: "ptx-1", reason: 3 });
    expect(res.result?.state).toBe(PAYME_STATE.CANCELLED);
  });

  it("cancels a performed transaction to state -2", async () => {
    await rpc("CreateTransaction", { id: "ptx-1", time: 1, account, amount: DEPOSIT });
    await rpc("PerformTransaction", { id: "ptx-1" });
    const res = await rpc("CancelTransaction", { id: "ptx-1", reason: 5 });
    expect(res.result?.state).toBe(PAYME_STATE.CANCELLED_AFTER_PERFORM);
  });

  it("is idempotent on a second cancel", async () => {
    await rpc("CreateTransaction", { id: "ptx-1", time: 1, account, amount: DEPOSIT });
    await rpc("CancelTransaction", { id: "ptx-1", reason: 3 });
    const res = await rpc("CancelTransaction", { id: "ptx-1", reason: 3 });
    expect(res.result?.state).toBe(PAYME_STATE.CANCELLED);
  });
});

// ---- CheckTransaction / GetStatement / unknown -----------------------------
describe("CheckTransaction & GetStatement", () => {
  it("returns the stored state for a known transaction", async () => {
    await rpc("CreateTransaction", { id: "ptx-1", time: 1, account, amount: DEPOSIT });
    const res = await rpc("CheckTransaction", { id: "ptx-1" });
    expect(res.result?.state).toBe(PAYME_STATE.CREATED);
  });

  it("lists transactions in the requested window", async () => {
    await rpc("CreateTransaction", { id: "ptx-1", time: 100, account, amount: DEPOSIT });
    const res = await rpc("GetStatement", { from: 0, to: 1000 });
    const txns = res.result?.transactions as unknown[];
    expect(Array.isArray(txns)).toBe(true);
    expect(txns).toHaveLength(1);
  });

  it("returns -32601 for an unknown method", async () => {
    const res = await rpc("NotARealMethod", {});
    expect(res.error?.code).toBe(PAYME_ERROR.METHOD_NOT_FOUND);
  });
});
