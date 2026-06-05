/**
 * Referral / viral loop (Phase AW). One shareable code per customer; each
 * referred lead is a `referrals` row crediting that code; conversion flips it.
 * The existing attribution pipeline already captures `?ref=CODE`, so the loop
 * is: customer shares code → friend visits with ?ref → leaves a lead → credited
 * → on the friend's purchase the referral converts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loosePhone } from "@/lib/phone";

/** A short, URL-safe, human-ish referral code. */
export function makeReferralCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => alphabet[b % alphabet.length]).join("");
}

/** Get (or lazily create) a customer's shareable referral code. */
export async function getOrCreateReferralCode(supabase: SupabaseClient, customerId: string, tenantId?: string): Promise<string | null> {
  try {
    const { data: existing } = await supabase.from("referral_codes").select("code").eq("customer_id", customerId).maybeSingle();
    if (existing?.code) return existing.code as string;
    // Try a few times in case of a code collision.
    for (let i = 0; i < 5; i++) {
      const code = makeReferralCode();
      const { error } = await supabase.from("referral_codes").insert({ customer_id: customerId, code, ...(tenantId ? { tenant_id: tenantId } : {}) });
      if (!error) return code;
      // Unique violation on customer_id → someone created it concurrently; re-read.
      const { data: now } = await supabase.from("referral_codes").select("code").eq("customer_id", customerId).maybeSingle();
      if (now?.code) return now.code as string;
    }
    return null;
  } catch {
    return null;
  }
}

/** Record a referred lead against a code (idempotent per referred phone+code). */
export async function creditReferral(
  supabase: SupabaseClient,
  code: string,
  referredPhone: string,
  referredInquiryId?: string | null,
): Promise<boolean> {
  const c = (code || "").trim().toUpperCase();
  const phone = loosePhone(referredPhone);
  if (!c || !phone) return false;
  try {
    const { data: rc } = await supabase.from("referral_codes").select("customer_id").eq("code", c).maybeSingle();
    if (!rc) return false; // unknown code
    // Don't double-credit the same referred phone under the same code.
    const { data: dupe } = await supabase
      .from("referrals")
      .select("id")
      .eq("code", c)
      .eq("referred_phone", phone)
      .maybeSingle();
    if (dupe) return false;
    await supabase.from("referrals").insert({
      referrer_customer_id: rc.customer_id,
      code: c,
      referred_phone: phone,
      referred_inquiry_id: referredInquiryId ?? null,
      status: "pending",
    });
    return true;
  } catch {
    return false;
  }
}

/** On a referred person's purchase, flip their pending referral(s) to converted. */
export async function markReferralConverted(supabase: SupabaseClient, referredPhone: string): Promise<number> {
  const phone = loosePhone(referredPhone);
  if (!phone) return 0;
  try {
    const { data } = await supabase
      .from("referrals")
      .update({ status: "converted" })
      .eq("referred_phone", phone)
      .eq("status", "pending")
      .select("id");
    return (data || []).length;
  } catch {
    return 0;
  }
}
