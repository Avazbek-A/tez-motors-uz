// Single source of truth for installment math. The full calculator
// (src/components/calculator/financing-calculator.tsx), the per-car "from
// $X/mo" badges, and the monthly-budget catalog filter all import from here so
// the numbers never disagree across surfaces.
//
// These are estimates only — real terms come from the bank. The defaults match
// what the dealer typically quotes for Chinese-import financing in Tashkent.

export interface FinanceTerms {
  /** Percentage of the price paid upfront (e.g. 30 = 30%). */
  downPaymentPct: number;
  /** Annual interest rate in percent (e.g. 18 = 18% APR). */
  annualRatePct: number;
  /** Loan term in months. */
  termMonths: number;
}

export const FINANCE_DEFAULTS: FinanceTerms = {
  downPaymentPct: 30,
  annualRatePct: 18,
  termMonths: 24,
};

/**
 * The PMT multiplier that turns a financed principal into a monthly payment:
 *   monthly = principal * paymentFactor(rate, months)
 * Handles the zero-interest edge (straight division).
 */
function paymentFactor(annualRatePct: number, termMonths: number): number {
  const n = Math.max(1, Math.round(termMonths));
  const r = annualRatePct / 100 / 12;
  if (r === 0) return 1 / n;
  const pow = Math.pow(1 + r, n);
  return (r * pow) / (pow - 1);
}

/** Monthly payment for a given car price and terms. Returns 0 for non-positive prices. */
export function monthlyPayment(price: number, terms: Partial<FinanceTerms> = {}): number {
  const { downPaymentPct, annualRatePct, termMonths } = { ...FINANCE_DEFAULTS, ...terms };
  if (!(price > 0)) return 0;
  const principal = price * (1 - downPaymentPct / 100);
  return principal * paymentFactor(annualRatePct, termMonths);
}

/**
 * The "from $X/mo" figure shown on cards/detail pages, rounded to a clean number.
 * Uses FINANCE_DEFAULTS unless overridden.
 */
export function estimatedMonthlyFrom(price: number, terms: Partial<FinanceTerms> = {}): number {
  return Math.round(monthlyPayment(price, terms));
}

/**
 * Invert the PMT formula: the maximum car price whose monthly payment is at or
 * below `monthly`, under the given terms. Used by the catalog monthly-budget
 * filter to translate a budget into a price_max ceiling.
 */
export function priceFromMonthly(monthly: number, terms: Partial<FinanceTerms> = {}): number {
  const { downPaymentPct, annualRatePct, termMonths } = { ...FINANCE_DEFAULTS, ...terms };
  if (!(monthly > 0)) return 0;
  const factor = paymentFactor(annualRatePct, termMonths);
  const downFraction = 1 - downPaymentPct / 100;
  if (downFraction <= 0 || factor <= 0) return 0;
  return monthly / (downFraction * factor);
}
