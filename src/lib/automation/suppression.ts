/**
 * Marketing suppression / unsubscribe (Phase AW Leap 1).
 *
 * The opt-out backbone: a contact on the list is never sent automated
 * marketing. Pure helpers for normalization + the unsubscribe token; DB checks
 * are async and fail-OPEN-to-suppressed on error is wrong (we'd spam), so they
 * fail-CLOSED conceptually only for the *send* path — i.e. on a DB error we
 * treat as "not suppressed" to avoid silently dropping all mail, but the
 * unsubscribe WRITE is what matters and is retried by the user's click.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { hmacSha256Hex } from "@/lib/hmac";
import { timingSafeEqual } from "@/lib/timing-safe";
import { canonicalPhone } from "@/lib/phone";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

/** Normalize a contact to its stored form: email lowercased, else a canonical
 *  phone (UZ +998…, falling back to digits-only) so the same number written in
 *  different formats compares equal. */
export function normalizeContact(raw: string): string {
  const t = (raw || "").trim();
  if (t.includes("@")) return t.toLowerCase();
  return canonicalPhone(t) || t.replace(/\D/g, "");
}

function unsubSecret(): string {
  // Reuse an existing server secret; falls back so dev still works.
  return process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || "tez-unsub";
}

/** A stable, verifiable unsubscribe token for a contact (one-click links). */
export async function unsubscribeToken(contact: string): Promise<string> {
  return (await hmacSha256Hex(unsubSecret(), `unsub:${normalizeContact(contact)}`)).slice(0, 32);
}

export async function verifyUnsubscribeToken(contact: string, token: string): Promise<boolean> {
  const expected = await unsubscribeToken(contact);
  return timingSafeEqual(expected, (token || "").trim());
}

/** Is this contact suppressed for the given channel (or all)? Fail-open on error. */
export async function isSuppressed(
  supabase: SupabaseClient,
  contact: string,
  channel?: string | null,
): Promise<boolean> {
  const c = normalizeContact(contact);
  if (!c) return false;
  try {
    const { data } = await supabase
      .from("marketing_suppressions")
      .select("channel")
      .eq("contact", c)
      .limit(20);
    if (!data || data.length === 0) return false;
    // "all" suppression blocks everything; else block when the specific channel matches.
    return data.some((r) => r.channel == null || (channel != null && r.channel === channel));
  } catch {
    return false; // don't let a transient DB error silently drop all sends
  }
}

/** Add a contact to the suppression list (idempotent). */
export async function suppress(
  supabase: SupabaseClient,
  contact: string,
  reason: "unsubscribe" | "bounce" | "complaint" | "manual" = "unsubscribe",
  channel?: string | null,
  tenantId: string = DEFAULT_TENANT_ID,
): Promise<boolean> {
  const c = normalizeContact(contact);
  if (!c) return false;
  try {
    await supabase
      .from("marketing_suppressions")
      .upsert({ contact: c, channel: channel ?? null, reason, tenant_id: tenantId }, { onConflict: "contact,channel", ignoreDuplicates: true })
      .then(() => {}, () => {});
    return true;
  } catch {
    return false;
  }
}
