/**
 * CRM helpers — pure, unit-tested. The Customer 360 stitches a person's
 * scattered records (inquiries, orders, AI conversations, deposits, account)
 * together by a stable phone key. UZ numbers come in many formats
 * (+998901234567, 998901234567, 901234567) so we key on the 9-digit national
 * core, which also doubles as an ILIKE needle that matches every format.
 */
import { normalizePhone } from "./customer-auth";

/** Stable grouping key for a phone, or null if it isn't phone-like. */
export function contactKey(phone?: string | null): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 7) return null;
  const n = normalizePhone(phone || ""); // "+998XXXXXXXXX" or null
  if (n) return n.slice(-9); // 9-digit UZ national core
  return digits.slice(-9); // fallback for non-UZ: last 9 digits
}

/** First non-empty, trimmed string from a list (for "best known name"). */
export function pickFirst(values: (string | null | undefined)[]): string | null {
  for (const v of values) {
    const t = (v || "").trim();
    if (t) return t;
  }
  return null;
}

export interface TimelineEvent {
  type: "inquiry" | "order" | "order_event" | "payment" | "conversation" | "account";
  title: string;
  detail?: string;
  at: string; // ISO
  link?: string;
}

/** Sort timeline events newest-first (ISO strings compare lexicographically). */
export function sortEventsDesc(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
}

/** Paid Payme amounts are stored in tiyin (1 UZS = 100 tiyin). */
export function tiyinToUzs(tiyin: number): number {
  return Math.round((Number.isFinite(tiyin) ? tiyin : 0) / 100);
}

export function uzsToUsd(uzs: number, usdUzs: number): number {
  return usdUzs > 0 ? Math.round(uzs / usdUzs) : 0;
}

/** The latest of a set of ISO timestamps (or null). */
export function latest(dates: (string | null | undefined)[]): string | null {
  const xs = dates.filter(Boolean) as string[];
  return xs.length ? xs.sort().slice(-1)[0] : null;
}

/** The earliest of a set of ISO timestamps (or null). */
export function earliest(dates: (string | null | undefined)[]): string | null {
  const xs = dates.filter(Boolean) as string[];
  return xs.length ? xs.sort()[0] : null;
}
