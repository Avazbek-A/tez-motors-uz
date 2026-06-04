import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { alertDealer, logEvent } from "@/lib/error-report";

/**
 * Synthetic monitoring (Phase AQ). Exercises the critical paths a customer
 * depends on and alerts the dealer the moment one breaks — proactively, before
 * a buyer hits the failure. Read-only probes; one throttled alert per run so a
 * sustained outage can't storm the dealer. Guarded by CRON_SECRET.
 */
async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  const checks: Record<string, boolean> = {};
  const supabase = createServiceClient();

  // 1) Catalog read — the core public surface.
  try {
    const { error } = await supabase.from("cars").select("id", { head: true, count: "exact" }).neq("inventory_status", "sold");
    checks.catalog = !error;
  } catch {
    checks.catalog = false;
  }

  // 2) Orders table reachable (track / deposits depend on it).
  try {
    const { error } = await supabase.from("orders").select("id", { head: true, count: "exact" });
    checks.orders = !error;
  } catch {
    checks.orders = false;
  }

  // 3) Payment config present when a merchant id is set (a half-configured
  //    payment env silently breaks checkout). Only assert when intended-live.
  const paymeIntended = !!process.env.NEXT_PUBLIC_PAYME_MERCHANT_ID;
  checks.payments = !paymeIntended || (!!process.env.PAYME_MERCHANT_KEY && !!process.env.PAYME_MERCHANT_ID);

  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  if (failed.length > 0) {
    logEvent("synthetic.fail", { failed }, "error");
    await alertDealer(
      "⚠️ Synthetic check failed — Tez Motors",
      [`Failing: ${failed.join(", ")}`, "A critical path is down — check the site before customers do."],
      { key: "synthetic.fail" },
    ).catch(() => {});
  } else {
    logEvent("synthetic.ok", checks);
  }

  return NextResponse.json({ ok: failed.length === 0, checks });
}

export const GET = handle;
export const POST = handle;
