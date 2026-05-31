import { describe, it, expect, afterEach } from "vitest";
import {
  md5,
  verifyClickSign,
  clickResponse,
  clickAmountToTiyin,
  CLICK_ACTION,
  CLICK_ERROR,
  type ClickCallback,
} from "../click";

const ORIGINAL_KEY = process.env.CLICK_SECRET_KEY;
afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.CLICK_SECRET_KEY;
  else process.env.CLICK_SECRET_KEY = ORIGINAL_KEY;
});

describe("md5 (RFC 1321 test vectors)", () => {
  it("hashes the empty string", () => {
    expect(md5("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
  });

  it("hashes 'abc'", () => {
    expect(md5("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
  });

  it("hashes the quick-brown-fox sentence", () => {
    expect(md5("The quick brown fox jumps over the lazy dog")).toBe(
      "9e107d9d372bb6826bd81d3542a419d6",
    );
  });

  it("hashes a long 80-char string (multi-block)", () => {
    expect(md5("12345678901234567890123456789012345678901234567890123456789012345678901234567890")).toBe(
      "57edf4a22be3c955ac49da2e2107b67a",
    );
  });
});

describe("clickAmountToTiyin", () => {
  it("converts whole UZS to tiyin", () => {
    expect(clickAmountToTiyin("630000.00")).toBe(63_000_000);
  });

  it("rounds to the nearest tiyin", () => {
    expect(clickAmountToTiyin("100.005")).toBe(Math.round(100.005 * 100));
  });

  it("returns NaN for a non-numeric amount", () => {
    expect(Number.isNaN(clickAmountToTiyin("not-a-number"))).toBe(true);
  });
});

// Build a callback whose sign_string is the real MD5 of the spec field order.
function signedCallback(secret: string, over: Partial<ClickCallback>, complete: boolean): ClickCallback {
  const cb: ClickCallback = {
    click_trans_id: "111",
    service_id: "222",
    merchant_trans_id: "order-abc",
    merchant_prepare_id: complete ? "prep-1" : "",
    amount: "630000.00",
    action: complete ? String(CLICK_ACTION.COMPLETE) : String(CLICK_ACTION.PREPARE),
    sign_time: "2026-01-01 00:00:00",
    sign_string: "",
    ...over,
  };
  const parts = [
    cb.click_trans_id,
    cb.service_id,
    secret,
    cb.merchant_trans_id,
    ...(complete ? [cb.merchant_prepare_id ?? ""] : []),
    cb.amount,
    cb.action,
    cb.sign_time,
  ];
  cb.sign_string = md5(parts.join(""));
  return cb;
}

describe("verifyClickSign", () => {
  it("fails closed when CLICK_SECRET_KEY is unset", () => {
    delete process.env.CLICK_SECRET_KEY;
    const cb = signedCallback("anything", {}, false);
    expect(verifyClickSign(cb)).toBe(false);
  });

  it("accepts a correctly signed Prepare callback", () => {
    process.env.CLICK_SECRET_KEY = "secret";
    expect(verifyClickSign(signedCallback("secret", {}, false))).toBe(true);
  });

  it("accepts a correctly signed Complete callback (includes merchant_prepare_id)", () => {
    process.env.CLICK_SECRET_KEY = "secret";
    expect(verifyClickSign(signedCallback("secret", {}, true))).toBe(true);
  });

  it("rejects a tampered amount", () => {
    process.env.CLICK_SECRET_KEY = "secret";
    const cb = signedCallback("secret", {}, false);
    cb.amount = "1.00";
    expect(verifyClickSign(cb)).toBe(false);
  });

  it("rejects a sign computed with the wrong secret", () => {
    process.env.CLICK_SECRET_KEY = "secret";
    expect(verifyClickSign(signedCallback("not-the-secret", {}, false))).toBe(false);
  });
});

describe("clickResponse", () => {
  it("includes a default error_note from the message map", () => {
    const body = clickResponse({
      click_trans_id: "1",
      merchant_trans_id: "o",
      error: CLICK_ERROR.SUCCESS,
    });
    expect(body).toMatchObject({ click_trans_id: "1", merchant_trans_id: "o", error: 0, error_note: "Success" });
  });

  it("omits prepare/confirm ids unless provided, and includes them when set", () => {
    const minimal = clickResponse({ click_trans_id: "1", merchant_trans_id: "o", error: -1 });
    expect("merchant_prepare_id" in minimal).toBe(false);
    expect("merchant_confirm_id" in minimal).toBe(false);

    const full = clickResponse({
      click_trans_id: "1",
      merchant_trans_id: "o",
      merchant_prepare_id: "p",
      merchant_confirm_id: "c",
      error: 0,
    });
    expect(full.merchant_prepare_id).toBe("p");
    expect(full.merchant_confirm_id).toBe("c");
  });
});
