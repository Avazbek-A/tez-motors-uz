/**
 * CRM insight helpers — pure, isolated, unit-tested. Classifies a contact into
 * a value tier and computes recency, for the Customer 360 list/profile and for
 * smarter segmentation. No I/O; safe to import anywhere.
 */

export type CustomerTier = "vip" | "buyer" | "active" | "lead" | "dormant";

export interface TierInput {
  ordersCount: number;
  depositsUsd: number;
  lastSeenDaysAgo: number | null;
  leadScore?: number;
}

/**
 * Value tier, most-valuable first:
 *  - vip     : a paying customer with repeat orders or a sizeable deposit
 *  - buyer   : has at least one order or any paid deposit
 *  - dormant : no purchase and not seen in over 90 days
 *  - active  : engaged in the last 14 days (or a hot lead score)
 *  - lead    : everyone else (known but cool)
 */
export function customerTier(i: TierInput): CustomerTier {
  const orders = Math.max(0, i.ordersCount || 0);
  const deposits = Math.max(0, i.depositsUsd || 0);
  const seen = i.lastSeenDaysAgo;
  const score = i.leadScore || 0;

  if (deposits >= 5000 || (orders >= 2 && deposits > 0)) return "vip";
  if (orders >= 1 || deposits > 0) return "buyer";
  if (seen != null && seen > 90) return "dormant";
  if ((seen != null && seen <= 14) || score >= 60) return "active";
  return "lead";
}

/** Whole days between an ISO timestamp and now (ms). Null if no date. */
export function daysSince(iso: string | null | undefined, nowMs: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((nowMs - t) / 86_400_000));
}

const TIER_LABELS: Record<CustomerTier, string> = {
  vip: "VIP",
  buyer: "Buyer",
  active: "Active",
  lead: "Lead",
  dormant: "Dormant",
};

export function tierLabel(t: CustomerTier): string {
  return TIER_LABELS[t];
}

/** Rank order for sorting contacts by value (vip first). */
export function tierRank(t: CustomerTier): number {
  return ["vip", "buyer", "active", "lead", "dormant"].indexOf(t);
}
