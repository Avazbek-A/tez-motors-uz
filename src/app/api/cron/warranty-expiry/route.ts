import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { sendDealerDigest } from "@/lib/cron/dealer-digest";
import { reportServerError, logEvent } from "@/lib/error-report";

/**
 * Warranties expiring within 30 days → one dealer digest, so the owner can
 * reach out (service check-up, extended-warranty upsell, repeat sale) before it
 * lapses. Weekly. Fail-open.
 */
async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("warranties")
      .select("car_label, customer_name, customer_phone, warranty_until")
      .gte("warranty_until", today)
      .lte("warranty_until", in30)
      .order("warranty_until", { ascending: true })
      .limit(50);
    if (error) return NextResponse.json({ ok: false, error: "query failed" }, { status: 500 });

    const rows = data || [];
    if (rows.length > 0) {
      const lines = rows.map((r) => `• ${r.warranty_until} — ${r.car_label} (${r.customer_name}${r.customer_phone ? `, ${r.customer_phone}` : ""})`);
      await sendDealerDigest(`Warranties expiring soon (${rows.length}) — Tez Motors`, lines);
    }

    logEvent("cron.warranty_expiry", { expiring: rows.length });
    return NextResponse.json({ ok: true, expiring: rows.length });
  } catch (error) {
    reportServerError("GET /api/cron/warranty-expiry", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
