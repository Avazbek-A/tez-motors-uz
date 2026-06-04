/**
 * FX exposure & hedging signal (Phase AK).
 *
 * The dealer pays Chinese suppliers in CNY but the order sits open for weeks
 * (production + shipping) before settlement — so CNY/USD moves between order and
 * payment swing the real cost. The system fetched CNY/UZS daily but used it for
 * display only. This quantifies the open exposure and emits an advisory
 * lock-vs-wait hint from the recent rate trend.
 *
 * Pure + unit-tested. ADVISORY only — never auto-acts (no autonomous money
 * movement). The dealer decides.
 */
export interface OpenCnyPo {
  /** Amount still owed to the supplier, in CNY. */
  amountCny: number;
  /** CNY→USD rate snapshot at order time (cny per 1 usd, e.g. 7.2). */
  cnyPerUsdAtOrder: number | null;
}

export interface FxExposure {
  /** Total open CNY payable across the POs. */
  totalCny: number;
  /** Its USD value at the CURRENT rate. */
  usdAtCurrent: number;
  /** Its USD value at the rates locked when each PO was ordered (null-safe). */
  usdAtOrder: number;
  /**
   * USD impact of the move since order: positive = the dealer now pays MORE
   * (CNY strengthened), negative = cheaper. This is the unrealized FX P&L.
   */
  driftUsd: number;
  driftPct: number;
}

/** cnyPerUsdNow: current CNY per 1 USD (e.g. cny_uzs / usd_uzs). */
export function computeFxExposure(pos: OpenCnyPo[], cnyPerUsdNow: number): FxExposure {
  let totalCny = 0;
  let usdAtOrder = 0;
  for (const p of pos) {
    const cny = Math.max(0, p.amountCny || 0);
    totalCny += cny;
    const orderRate = p.cnyPerUsdAtOrder && p.cnyPerUsdAtOrder > 0 ? p.cnyPerUsdAtOrder : cnyPerUsdNow;
    usdAtOrder += orderRate > 0 ? cny / orderRate : 0;
  }
  const usdAtCurrent = cnyPerUsdNow > 0 ? totalCny / cnyPerUsdNow : 0;
  // More USD needed now than at order = a cost increase (positive drift).
  const driftUsd = Math.round(usdAtCurrent - usdAtOrder);
  const driftPct = usdAtOrder > 0 ? Math.round((driftUsd / usdAtOrder) * 1000) / 10 : 0;
  return {
    totalCny: Math.round(totalCny),
    usdAtCurrent: Math.round(usdAtCurrent),
    usdAtOrder: Math.round(usdAtOrder),
    driftUsd,
    driftPct,
  };
}

export type HedgeSignal = "lock" | "wait" | "neutral";

/**
 * Advisory lock-vs-wait hint from a short rate history (most recent last),
 * expressed as CNY per USD. If CNY is strengthening against USD (rate falling —
 * fewer CNY per USD → each USD buys less CNY → imports getting more expensive),
 * suggest locking now. If weakening (rate rising), waiting may be cheaper.
 * Threshold avoids reacting to noise. Heuristic, not a forecast.
 */
export function hedgeSignal(cnyPerUsdHistory: number[], thresholdPct = 1): HedgeSignal {
  const h = cnyPerUsdHistory.filter((n) => Number.isFinite(n) && n > 0);
  if (h.length < 2) return "neutral";
  const first = h[0];
  const last = h[h.length - 1];
  const changePct = ((last - first) / first) * 100;
  if (changePct <= -thresholdPct) return "lock"; // CNY strengthening → imports pricier
  if (changePct >= thresholdPct) return "wait"; // CNY weakening → may get cheaper
  return "neutral";
}
