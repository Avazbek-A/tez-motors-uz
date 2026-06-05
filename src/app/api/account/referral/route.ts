import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCustomerContext } from "@/lib/customer-auth";
import { getOrCreateReferralCode } from "@/lib/automation/referral";

/**
 * The logged-in customer's referral code, share link, and stats (Phase AW).
 * Lazily mints a code on first view.
 */
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://tezmotors.uz").replace(/\/$/, "");

export async function GET(request: NextRequest) {
  const ctx = await getCustomerContext(request);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = createServiceClient();
  const code = await getOrCreateReferralCode(supabase, ctx.customer.id);
  if (!code) return NextResponse.json({ error: "Could not create code" }, { status: 500 });

  const { data: refs } = await supabase
    .from("referrals")
    .select("status")
    .eq("referrer_customer_id", ctx.customer.id)
    .limit(1000);
  const total = (refs || []).length;
  const converted = (refs || []).filter((r) => r.status === "converted" || r.status === "rewarded").length;

  const locale = ctx.customer.locale || "ru";
  return NextResponse.json({
    code,
    share_url: `${SITE}/${locale}/catalog?ref=${code}`,
    referred: total,
    converted,
  });
}
