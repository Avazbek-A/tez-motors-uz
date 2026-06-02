/**
 * Constant-time string comparison for secrets/tokens. Avoids leaking how many
 * leading characters matched via response timing. Pure; used by the cron guard
 * and any other shared-secret check.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
