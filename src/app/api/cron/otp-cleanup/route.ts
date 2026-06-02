import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { reportServerError, logEvent } from "@/lib/error-report";

/**
 * Housekeeping sweep for one-time passwords. OTP rows are short-lived (a few
 * minutes TTL) but never self-delete, so they accumulate forever. This job
 * prunes any row that is either consumed or past its expiry. Idempotent and
 * cheap; runs on a slow cadence from the cron Worker.
 *
 * Fail-soft: a failure logs and returns 500 but never throws — the next tick
 * retries. assertCron fails CLOSED when CRON_SECRET is set.
 */
async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const supabase = createServiceClient();
    const nowIso = new Date().toISOString();

    // Delete expired OR already-consumed codes. Two narrow deletes keep the
    // predicate simple and index-friendly (idx_otp_codes_phone covers neither,
    // but the table is small and bounded by this very sweep).
    const { error: expiredErr, count: expiredCount } = await supabase
      .from("otp_codes")
      .delete({ count: "exact" })
      .lt("expires_at", nowIso);

    const { error: consumedErr, count: consumedCount } = await supabase
      .from("otp_codes")
      .delete({ count: "exact" })
      .not("consumed_at", "is", null);

    if (expiredErr || consumedErr) {
      return NextResponse.json({ ok: false, error: "delete failed" }, { status: 500 });
    }

    const deleted = (expiredCount || 0) + (consumedCount || 0);
    logEvent("cron.otp_cleanup", { deleted });
    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    reportServerError("POST /api/cron/otp-cleanup", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
