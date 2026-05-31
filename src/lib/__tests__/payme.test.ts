import { describe, it, expect, afterEach } from "vitest";
import { usdToTiyin, tiyinToUzs, checkPaymeAuth, PAYME_STATE, PAYME_ERROR } from "../payme";

function basic(login: string, password: string): string {
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
}

const ORIGINAL_KEY = process.env.PAYME_MERCHANT_KEY;
afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.PAYME_MERCHANT_KEY;
  else process.env.PAYME_MERCHANT_KEY = ORIGINAL_KEY;
});

describe("payme amount conversion", () => {
  it("converts USD to tiyin (1 UZS = 100 tiyin)", () => {
    // $500 at 12,600 UZS/USD = 6,300,000 UZS = 630,000,000 tiyin.
    expect(usdToTiyin(500, 12600)).toBe(630_000_000);
  });

  it("rounds to the nearest tiyin", () => {
    expect(usdToTiyin(1, 12599.5)).toBe(Math.round(1 * 12599.5 * 100));
  });

  it("round-trips tiyin back to whole UZS", () => {
    expect(tiyinToUzs(630_000_000)).toBe(6_300_000);
  });
});

describe("payme auth", () => {
  it("fails closed when the merchant key is unset", () => {
    delete process.env.PAYME_MERCHANT_KEY;
    expect(checkPaymeAuth(basic("Paycom", "anything"))).toBe(false);
  });

  it("accepts the correct key regardless of login", () => {
    process.env.PAYME_MERCHANT_KEY = "secret-key";
    expect(checkPaymeAuth(basic("Paycom", "secret-key"))).toBe(true);
    expect(checkPaymeAuth(basic("anyone", "secret-key"))).toBe(true);
  });

  it("rejects a wrong key, missing header, or malformed header", () => {
    process.env.PAYME_MERCHANT_KEY = "secret-key";
    expect(checkPaymeAuth(basic("Paycom", "wrong"))).toBe(false);
    expect(checkPaymeAuth(null)).toBe(false);
    expect(checkPaymeAuth("Bearer secret-key")).toBe(false);
    expect(checkPaymeAuth("Basic not-base64!!")).toBe(false);
  });
});

describe("payme protocol constants", () => {
  it("uses the canonical Payme transaction states", () => {
    expect(PAYME_STATE).toEqual({
      CREATED: 1,
      PERFORMED: 2,
      CANCELLED: -1,
      CANCELLED_AFTER_PERFORM: -2,
    });
  });

  it("uses the spec error codes for auth/amount/transaction", () => {
    expect(PAYME_ERROR.INSUFFICIENT_PRIVILEGE).toBe(-32504);
    expect(PAYME_ERROR.INVALID_AMOUNT).toBe(-31001);
    expect(PAYME_ERROR.TRANSACTION_NOT_FOUND).toBe(-31003);
  });
});
