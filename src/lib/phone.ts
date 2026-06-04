/**
 * Phone-string helpers — shared across order lookups (track, receipt) and
 * customer auth.
 *
 * Two distinct shapes:
 *  - `loosePhone()` strips whitespace / dashes / parens so two strings that
 *    represent the same number compare equal. Use for matching against a
 *    stored value that may have been written in any format. NEVER use this
 *    output as a canonical identity — it preserves trunk zeros / country codes
 *    exactly as the caller passed them.
 *  - `canonicalPhone()` (re-exported from customer-auth) coerces UZ numbers to
 *    `+998XXXXXXXXX`. Returns null if it can't get to 9 national digits.
 *    Use when an UZ canonical form is required (account identity, OTP lookup).
 */
export function loosePhone(phone: string | null | undefined): string {
  return (phone || "").replace(/[\s\-()]/g, "");
}

export { normalizePhone as canonicalPhone } from "@/lib/customer-auth";
