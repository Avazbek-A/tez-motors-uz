/**
 * Financial foresight (Phase AG) — turn the money snapshot into a forecast.
 *
 * Pure functions over plain rows (the route gathers them); unit-tested. All
 * amounts in USD unless named *Uzs. "Aging" = how overdue a receivable/payable
 * is; "runway" = how long current cash lasts at the net burn; "deals" join the
 * order → cost → deposit → invoice lifecycle into realized/projected margin.
 */

const DAY = 86_400_000;

export interface AgingBuckets {
  d0_30: number;
  d30_60: number;
  d60_90: number;
  d90_plus: number;
  total: number;
}

/** Bucket {amountUsd, refMs} by age in days from `nowMs` (negative age → not-yet-due → d0_30). */
export function bucketByAge(items: { amountUsd: number; refMs: number }[], nowMs: number): AgingBuckets {
  const b: AgingBuckets = { d0_30: 0, d30_60: 0, d60_90: 0, d90_plus: 0, total: 0 };
  for (const it of items) {
    const amt = Number(it.amountUsd) || 0;
    if (amt <= 0) continue;
    const ageDays = (nowMs - it.refMs) / DAY;
    if (ageDays < 30) b.d0_30 += amt;
    else if (ageDays < 60) b.d30_60 += amt;
    else if (ageDays < 90) b.d60_90 += amt;
    else b.d90_plus += amt;
    b.total += amt;
  }
  return round(b);
}

function round(b: AgingBuckets): AgingBuckets {
  return {
    d0_30: Math.round(b.d0_30), d30_60: Math.round(b.d30_60),
    d60_90: Math.round(b.d60_90), d90_plus: Math.round(b.d90_plus), total: Math.round(b.total),
  };
}

/** AR aging: unpaid (sent) invoices, aged from their due date (or issue date). */
export function arAging(invoices: { total_usd: number; status: string; due_at: string | null; issued_at: string | null }[], nowMs: number): AgingBuckets {
  const items = invoices
    .filter((i) => i.status === "sent")
    .map((i) => ({ amountUsd: Number(i.total_usd) || 0, refMs: new Date(i.due_at || i.issued_at || nowMs).getTime() }));
  return bucketByAge(items, nowMs);
}

/** Deposits we hold but haven't earned yet — a liability until the car is delivered. */
export function depositsHeldAsLiability(
  orders: { id: string; status: string }[],
  depositsByOrder: Map<string, number>,
): number {
  let sum = 0;
  for (const o of orders) {
    if (o.status === "deposit_paid" || o.status === "sourcing" || o.status === "in_transit" || o.status === "at_customs" || o.status === "ready_for_pickup") {
      sum += depositsByOrder.get(o.id) || 0;
    }
  }
  return Math.round(sum);
}

export interface Runway {
  cashNowUsd: number;
  monthlyInflowUsd: number;
  monthlyOutflowUsd: number;
  netMonthlyUsd: number; // inflow - outflow (negative = burning)
  runwayMonths: number | null; // null = not burning (infinite)
}

/** Cash runway from current cash + monthly in/out. */
export function cashRunway(cashNowUsd: number, monthlyInflowUsd: number, monthlyOutflowUsd: number): Runway {
  const net = monthlyInflowUsd - monthlyOutflowUsd;
  const runwayMonths = net < 0 && cashNowUsd > 0 ? Math.round((cashNowUsd / -net) * 10) / 10 : null;
  return {
    cashNowUsd: Math.round(cashNowUsd),
    monthlyInflowUsd: Math.round(monthlyInflowUsd),
    monthlyOutflowUsd: Math.round(monthlyOutflowUsd),
    netMonthlyUsd: Math.round(net),
    runwayMonths,
  };
}

export interface DealPnl {
  orderId: string;
  reference: string;
  car: string;
  status: string;
  listUsd: number;
  costUsd: number | null;
  depositUsd: number;
  marginUsd: number | null; // list - cost
  realized: boolean; // delivered
}

/** Per-deal P&L lifecycle from joined rows. marginUsd null when cost unknown. */
export function dealPnl(
  order: { id: string; reference_code: string; status: string; amount_usd: number | null; car: string },
  costUsd: number | null,
  depositUsd: number,
): DealPnl {
  const listUsd = Number(order.amount_usd) || 0;
  const margin = costUsd != null ? Math.round(listUsd - costUsd) : null;
  return {
    orderId: order.id,
    reference: order.reference_code,
    car: order.car,
    status: order.status,
    listUsd: Math.round(listUsd),
    costUsd: costUsd != null ? Math.round(costUsd) : null,
    depositUsd: Math.round(depositUsd),
    marginUsd: margin,
    realized: order.status === "delivered",
  };
}

export interface FxScenario { pct: number; usdUzsAt: number; uzsValue: number; }

/** What `usdAtRiskUsd` is worth in UZS now and if the soum weakens/strengthens. */
export function fxExposureScenarios(usdAtRiskUsd: number, usdUzs: number, pcts: number[] = [-10, -5, 0, 5, 10]): FxScenario[] {
  return pcts.map((pct) => {
    const rate = usdUzs * (1 + pct / 100);
    return { pct, usdUzsAt: Math.round(rate), uzsValue: Math.round(usdAtRiskUsd * rate) };
  });
}
