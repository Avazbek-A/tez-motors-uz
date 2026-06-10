/**
 * After-sales / warranty math — pure, unit-tested. Compute a warranty's expiry
 * from the delivery date + term, classify its status, and total service costs.
 */
export type WarrantyStatus = "active" | "expiring" | "expired" | "none";

export interface ServiceRecord {
  date: string;
  odometer_km?: number | null;
  description: string;
  cost_usd?: number | null;
}

/** Add `months` to an ISO/`YYYY-MM-DD` delivery date → `YYYY-MM-DD` expiry, or
 *  null. Uses UTC component math so it's deterministic regardless of timezone. */
export function warrantyUntil(deliveredAt: string | null | undefined, months: number | null | undefined): string | null {
  if (!deliveredAt || !months || months <= 0) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(deliveredAt));
  if (!m) return null;
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1 + Math.round(months), +m[3]));
  if (!Number.isFinite(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

/** Status of a warranty given its expiry. "expiring" = within 30 days. */
export function warrantyStatus(until: string | null | undefined, nowMs: number): WarrantyStatus {
  if (!until) return "none";
  const end = new Date(until).getTime();
  if (!Number.isFinite(end)) return "none";
  // `until` is a date with no time, parsed as UTC midnight. The warranty is
  // valid through the WHOLE of that day, so it's only expired once `now` is past
  // the end of the until-day — otherwise a still-valid warranty reads "expired"
  // from the morning of its final day onward in positive timezones (UTC+5 here).
  if (nowMs >= end + 86_400_000) return "expired";
  const daysLeft = Math.floor((end - nowMs) / 86_400_000);
  if (daysLeft <= 30) return "expiring";
  return "active";
}

export function daysLeft(until: string | null | undefined, nowMs: number): number | null {
  if (!until) return null;
  const end = new Date(until).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.floor((end - nowMs) / 86_400_000);
}

export function totalServiceCost(services: ServiceRecord[] | null | undefined): number {
  return (services || []).reduce((a, s) => a + (Number(s.cost_usd) || 0), 0);
}
