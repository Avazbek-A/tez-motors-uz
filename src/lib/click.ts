/**
 * Click.uz Merchant API (SHOP-API "Prepare / Complete") protocol helpers.
 *
 * Click drives a deposit by POSTing application/x-www-form-urlencoded callbacks
 * to our endpoint (/api/payments/click):
 *   action=0 Prepare   — reserve the payment, return a merchant_prepare_id
 *   action=1 Complete  — confirm (or, with a non-zero `error`, cancel) the payment
 * Each callback is signed with MD5 over a fixed field order plus the secret key.
 *
 * Workers-safe: Web Crypto's subtle.digest has no MD5, so this module ships a
 * compact pure-JS MD5 (no node-only deps). Ships dark: when CLICK_SECRET_KEY is
 * unset, sign verification fails closed (every call → SIGN_CHECK_FAILED) so the
 * endpoint is inert rather than crashing.
 */
import { timingSafeEqual } from "@/lib/timing-safe";

// ---- Click action + error codes (from the Click SHOP-API spec) ------------

export const CLICK_ACTION = {
  PREPARE: 0,
  COMPLETE: 1,
} as const;

export const CLICK_ERROR = {
  SUCCESS: 0,
  SIGN_CHECK_FAILED: -1,
  INVALID_AMOUNT: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  ORDER_NOT_FOUND: -5,
  TRANSACTION_NOT_FOUND: -6,
  FAILED_TO_UPDATE: -7,
  BAD_REQUEST: -8,
  TRANSACTION_CANCELLED: -9,
} as const;

export const CLICK_MESSAGES: Record<number, string> = {
  [CLICK_ERROR.SUCCESS]: "Success",
  [CLICK_ERROR.SIGN_CHECK_FAILED]: "SIGN CHECK FAILED",
  [CLICK_ERROR.INVALID_AMOUNT]: "Incorrect parameter amount",
  [CLICK_ERROR.ACTION_NOT_FOUND]: "Action not found",
  [CLICK_ERROR.ALREADY_PAID]: "Already paid",
  [CLICK_ERROR.ORDER_NOT_FOUND]: "Order not found",
  [CLICK_ERROR.TRANSACTION_NOT_FOUND]: "Transaction does not exist",
  [CLICK_ERROR.FAILED_TO_UPDATE]: "Failed to update",
  [CLICK_ERROR.BAD_REQUEST]: "Error in request from click",
  [CLICK_ERROR.TRANSACTION_CANCELLED]: "Transaction cancelled",
};

// ---- Pure-JS MD5 (RFC 1321) — Workers-safe, no crypto.subtle MD5 ----------

function md5(input: string): string {
  function toBytes(str: string): number[] {
    // Click signs over UTF-8 bytes; encode then map.
    const utf8 = unescape(encodeURIComponent(str));
    const bytes: number[] = [];
    for (let i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i) & 0xff);
    return bytes;
  }

  function add32(a: number, b: number): number {
    return (a + b) & 0xffffffff;
  }
  function rol(num: number, cnt: number): number {
    return (num << cnt) | (num >>> (32 - cnt));
  }
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
    a = add32(add32(a, q), add32(x, t));
    return add32(rol(a, s), b);
  }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(c ^ (b | ~d), a, b, x, s, t);
  }

  const bytes = toBytes(input);
  const origLenBits = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  // Append 64-bit little-endian length. Split into low/high 32-bit words — JS
  // `>>>` takes its shift count mod 32, so a single `>>> (8*i)` loop would wrap
  // for i >= 4 and corrupt the high word (breaks any input ≥ 1 byte).
  const lo = origLenBits >>> 0;
  const hi = Math.floor(origLenBits / 0x100000000) >>> 0;
  for (let i = 0; i < 4; i++) bytes.push((lo >>> (8 * i)) & 0xff);
  for (let i = 0; i < 4; i++) bytes.push((hi >>> (8 * i)) & 0xff);

  const words: number[] = [];
  for (let i = 0; i < bytes.length; i += 4) {
    words.push(bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24));
  }

  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;

  for (let i = 0; i < words.length; i += 16) {
    const oa = a, ob = b, oc = c, od = d;
    const x = words.slice(i, i + 16);

    a = ff(a, b, c, d, x[0], 7, -680876936);
    d = ff(d, a, b, c, x[1], 12, -389564586);
    c = ff(c, d, a, b, x[2], 17, 606105819);
    b = ff(b, c, d, a, x[3], 22, -1044525330);
    a = ff(a, b, c, d, x[4], 7, -176418897);
    d = ff(d, a, b, c, x[5], 12, 1200080426);
    c = ff(c, d, a, b, x[6], 17, -1473231341);
    b = ff(b, c, d, a, x[7], 22, -45705983);
    a = ff(a, b, c, d, x[8], 7, 1770035416);
    d = ff(d, a, b, c, x[9], 12, -1958414417);
    c = ff(c, d, a, b, x[10], 17, -42063);
    b = ff(b, c, d, a, x[11], 22, -1990404162);
    a = ff(a, b, c, d, x[12], 7, 1804603682);
    d = ff(d, a, b, c, x[13], 12, -40341101);
    c = ff(c, d, a, b, x[14], 17, -1502002290);
    b = ff(b, c, d, a, x[15], 22, 1236535329);

    a = gg(a, b, c, d, x[1], 5, -165796510);
    d = gg(d, a, b, c, x[6], 9, -1069501632);
    c = gg(c, d, a, b, x[11], 14, 643717713);
    b = gg(b, c, d, a, x[0], 20, -373897302);
    a = gg(a, b, c, d, x[5], 5, -701558691);
    d = gg(d, a, b, c, x[10], 9, 38016083);
    c = gg(c, d, a, b, x[15], 14, -660478335);
    b = gg(b, c, d, a, x[4], 20, -405537848);
    a = gg(a, b, c, d, x[9], 5, 568446438);
    d = gg(d, a, b, c, x[14], 9, -1019803690);
    c = gg(c, d, a, b, x[3], 14, -187363961);
    b = gg(b, c, d, a, x[8], 20, 1163531501);
    a = gg(a, b, c, d, x[13], 5, -1444681467);
    d = gg(d, a, b, c, x[2], 9, -51403784);
    c = gg(c, d, a, b, x[7], 14, 1735328473);
    b = gg(b, c, d, a, x[12], 20, -1926607734);

    a = hh(a, b, c, d, x[5], 4, -378558);
    d = hh(d, a, b, c, x[8], 11, -2022574463);
    c = hh(c, d, a, b, x[11], 16, 1839030562);
    b = hh(b, c, d, a, x[14], 23, -35309556);
    a = hh(a, b, c, d, x[1], 4, -1530992060);
    d = hh(d, a, b, c, x[4], 11, 1272893353);
    c = hh(c, d, a, b, x[7], 16, -155497632);
    b = hh(b, c, d, a, x[10], 23, -1094730640);
    a = hh(a, b, c, d, x[13], 4, 681279174);
    d = hh(d, a, b, c, x[0], 11, -358537222);
    c = hh(c, d, a, b, x[3], 16, -722521979);
    b = hh(b, c, d, a, x[6], 23, 76029189);
    a = hh(a, b, c, d, x[9], 4, -640364487);
    d = hh(d, a, b, c, x[12], 11, -421815835);
    c = hh(c, d, a, b, x[15], 16, 530742520);
    b = hh(b, c, d, a, x[2], 23, -995338651);

    a = ii(a, b, c, d, x[0], 6, -198630844);
    d = ii(d, a, b, c, x[7], 10, 1126891415);
    c = ii(c, d, a, b, x[14], 15, -1416354905);
    b = ii(b, c, d, a, x[5], 21, -57434055);
    a = ii(a, b, c, d, x[12], 6, 1700485571);
    d = ii(d, a, b, c, x[3], 10, -1894986606);
    c = ii(c, d, a, b, x[10], 15, -1051523);
    b = ii(b, c, d, a, x[1], 21, -2054922799);
    a = ii(a, b, c, d, x[8], 6, 1873313359);
    d = ii(d, a, b, c, x[15], 10, -30611744);
    c = ii(c, d, a, b, x[6], 15, -1560198380);
    b = ii(b, c, d, a, x[13], 21, 1309151649);
    a = ii(a, b, c, d, x[4], 6, -145523070);
    d = ii(d, a, b, c, x[11], 10, -1120210379);
    c = ii(c, d, a, b, x[2], 15, 718787259);
    b = ii(b, c, d, a, x[9], 21, -343485551);

    a = add32(a, oa);
    b = add32(b, ob);
    c = add32(c, oc);
    d = add32(d, od);
  }

  function toHex(n: number): string {
    let s = "";
    for (let i = 0; i < 4; i++) {
      s += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, "0");
    }
    return s;
  }
  return toHex(a) + toHex(b) + toHex(c) + toHex(d);
}

export { md5 };

// ---- Sign verification ----------------------------------------------------

// Constant-time hex-string compare lives in @/lib/timing-safe — one impl across
// the codebase (also adds a string-type guard the local copy didn't have).

export interface ClickCallback {
  click_trans_id: string;
  service_id: string;
  merchant_trans_id: string;
  merchant_prepare_id?: string;
  amount: string;
  action: string;
  sign_time: string;
  sign_string: string;
  error?: string;
  error_note?: string;
}

/**
 * Verify the Click MD5 signature. Field order is fixed by the spec; merchant_prepare_id
 * is included only for Complete (action=1). Fails closed when CLICK_SECRET_KEY is unset.
 */
export function verifyClickSign(cb: ClickCallback): boolean {
  const secret = process.env.CLICK_SECRET_KEY;
  if (!secret) return false;

  const isComplete = cb.action === String(CLICK_ACTION.COMPLETE);
  const parts = [
    cb.click_trans_id,
    cb.service_id,
    secret,
    cb.merchant_trans_id,
    ...(isComplete ? [cb.merchant_prepare_id ?? ""] : []),
    cb.amount,
    cb.action,
    cb.sign_time,
  ];
  const expected = md5(parts.join(""));
  return timingSafeEqual(expected.toLowerCase(), (cb.sign_string || "").toLowerCase());
}

/** Build the Click JSON-RPC-ish callback response (always HTTP 200). */
export function clickResponse(fields: {
  click_trans_id: string;
  merchant_trans_id: string;
  merchant_prepare_id?: string | number;
  merchant_confirm_id?: string | number;
  error: number;
  error_note?: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    click_trans_id: fields.click_trans_id,
    merchant_trans_id: fields.merchant_trans_id,
    error: fields.error,
    error_note: fields.error_note ?? CLICK_MESSAGES[fields.error] ?? "",
  };
  if (fields.merchant_prepare_id !== undefined) body.merchant_prepare_id = fields.merchant_prepare_id;
  if (fields.merchant_confirm_id !== undefined) body.merchant_confirm_id = fields.merchant_confirm_id;
  return body;
}

/** Click sends amount in whole UZS (e.g. "630000.00"); convert to tiyin. */
export function clickAmountToTiyin(amount: string): number {
  const uzs = parseFloat(amount);
  if (!Number.isFinite(uzs)) return NaN;
  return Math.round(uzs * 100);
}
