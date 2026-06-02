/**
 * Financial back-office math — pure, unit-tested. Invoice totals (with VAT/QQS)
 * and multi-currency expense normalization (USD / UZS / CNY → USD) so the
 * P&L and tax report compare like with like. The reference currency is USD;
 * the UI converts to so'm via the live FX rate for display.
 */

export interface LineItem {
  description: string;
  qty: number;
  unitUsd: number;
}

const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export function lineItemsSubtotal(items: LineItem[]): number {
  return round2((items || []).reduce((a, l) => a + Math.max(0, l.qty || 0) * Math.max(0, l.unitUsd || 0), 0));
}

export interface InvoiceTotals {
  subtotalUsd: number;
  vatUsd: number;
  totalUsd: number;
}

/** Subtotal from line items + VAT on top. */
export function computeInvoiceTotals(items: LineItem[], vatPct: number): InvoiceTotals {
  const subtotalUsd = lineItemsSubtotal(items);
  const vat = round2(subtotalUsd * (Math.max(0, vatPct || 0) / 100));
  return { subtotalUsd, vatUsd: vat, totalUsd: round2(subtotalUsd + vat) };
}

export type ExpenseCurrency = "USD" | "UZS" | "CNY";

/** Convert an expense amount to USD using the CBU rates. CNY supplier payments
 *  route via UZS (CNY→UZS→USD), matching how cbu.uz quotes both. */
export function normalizeExpenseToUsd(
  amount: number,
  currency: ExpenseCurrency,
  fx: { usd_uzs: number; cny_uzs: number },
): number {
  const a = Math.max(0, amount || 0);
  if (currency === "USD") return round2(a);
  if (!(fx.usd_uzs > 0)) return 0;
  if (currency === "UZS") return round2(a / fx.usd_uzs);
  if (currency === "CNY") return round2((a * (fx.cny_uzs || 0)) / fx.usd_uzs);
  return 0;
}

export const EXPENSE_CATEGORIES = [
  "supplier_payment",
  "freight",
  "customs",
  "logistics",
  "certification",
  "marketing",
  "salary",
  "office",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function isExpenseCategory(v: string): v is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(v);
}
