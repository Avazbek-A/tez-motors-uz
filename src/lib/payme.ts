/**
 * Payme (Paycom) Merchant API protocol helpers.
 *
 * The merchant endpoint (src/app/api/payments/payme/route.ts) speaks JSON-RPC 2.0
 * over a single HTTP POST — Workers-safe, no node-only deps. This module holds
 * the pure protocol pieces: state/error constants, Basic-auth verification, the
 * JSON-RPC envelope builders, and UZS↔tiyin conversion. Keeping them here makes
 * the route handler a thin dispatcher and the protocol unit-testable.
 *
 * Ships dark until the dealer completes Payme onboarding: when PAYME_MERCHANT_KEY
 * is unset, auth fails closed (every call returns -32504) so the endpoint is inert
 * rather than crashing.
 */
import { NextResponse } from "next/server";
import { timingSafeEqual } from "@/lib/timing-safe";

// Payme transaction lifecycle states.
export const PAYME_STATE = {
  CREATED: 1,
  PERFORMED: 2,
  CANCELLED: -1,
  CANCELLED_AFTER_PERFORM: -2,
} as const;

// JSON-RPC error codes from the Payme Merchant API spec. The account-range codes
// (-31050..-31099) are merchant-defined; we use two of them for "order not found"
// and "order already has a pending transaction".
export const PAYME_ERROR = {
  PARSE_ERROR: -32700,
  INVALID_RPC: -32600,
  METHOD_NOT_FOUND: -32601,
  INSUFFICIENT_PRIVILEGE: -32504,
  INVALID_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  CANNOT_CANCEL: -31007,
  CANNOT_PERFORM: -31008,
  ORDER_NOT_FOUND: -31050,
  ORDER_BUSY: -31051,
} as const;

// The account field Payme is configured to send (ac.order_id=<orders.id>).
export const PAYME_ACCOUNT_FIELD = "order_id";

// Deposit used when an order carries no explicit amount_usd. Kept here so the
// checkout route and any future UI share one default.
export const DEFAULT_DEPOSIT_USD = 500;

type LocalizedMessage = { ru: string; uz: string; en: string };

export interface PaymeRpcError {
  code: number;
  message: string | LocalizedMessage;
  data?: string;
}

/** Bilingual messages for the errors that surface to the Payme cabinet/sandbox. */
export const PAYME_MESSAGES = {
  orderNotFound: {
    ru: "Заказ не найден",
    uz: "Buyurtma topilmadi",
    en: "Order not found",
  },
  invalidAmount: {
    ru: "Неверная сумма",
    uz: "Noto'g'ri summa",
    en: "Invalid amount",
  },
  orderBusy: {
    ru: "По заказу уже есть незавершённая транзакция",
    uz: "Buyurtma bo'yicha tugallanmagan tranzaksiya mavjud",
    en: "Order already has a pending transaction",
  },
  transactionNotFound: {
    ru: "Транзакция не найдена",
    uz: "Tranzaksiya topilmadi",
    en: "Transaction not found",
  },
  cannotPerform: {
    ru: "Невозможно выполнить операцию",
    uz: "Amalni bajarib bo'lmaydi",
    en: "Unable to perform operation",
  },
  unauthorized: {
    ru: "Недостаточно привилегий",
    uz: "Ruxsat yetarli emas",
    en: "Insufficient privilege",
  },
  methodNotFound: {
    ru: "Метод не найден",
    uz: "Metod topilmadi",
    en: "Method not found",
  },
} as const;

// Constant-time compare lives in @/lib/timing-safe (one implementation across
// the codebase — also adds a string-type guard the local copy didn't have).

/**
 * Verify the `Authorization: Basic base64(login:key)` header against the merchant
 * key. Fails closed when PAYME_MERCHANT_KEY is unset (feature ships dark).
 */
export function checkPaymeAuth(authHeader: string | null): boolean {
  const key = process.env.PAYME_MERCHANT_KEY;
  if (!key) return false;
  if (!authHeader || !authHeader.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = atob(authHeader.slice("Basic ".length).trim());
  } catch {
    return false;
  }
  // Format is "login:password"; Payme's login is "Paycom", password is the key.
  const sep = decoded.indexOf(":");
  if (sep === -1) return false;
  const password = decoded.slice(sep + 1);
  return timingSafeEqual(password, key);
}

/** JSON-RPC success envelope (Payme always replies HTTP 200). */
export function rpcResult(id: unknown, result: unknown): NextResponse {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result }, { status: 200 });
}

/** JSON-RPC error envelope. */
export function rpcError(id: unknown, error: PaymeRpcError): NextResponse {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error }, { status: 200 });
}

/** Convert a USD amount to Payme's native unit (tiyin = 1/100 UZS). */
export function usdToTiyin(usd: number, usdUzsRate: number): number {
  return Math.round(usd * usdUzsRate * 100);
}

/** Convert tiyin back to whole UZS (for display). */
export function tiyinToUzs(tiyin: number): number {
  return Math.round(tiyin / 100);
}
