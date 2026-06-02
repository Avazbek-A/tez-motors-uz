import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { setFxRates } from "@/lib/fx-rate";
import { reportServerError, logEvent } from "@/lib/error-report";

/** Fetch one currency's UZS rate from cbu.uz; null on any failure (fail-open). */
async function fetchCbuRate(ccy: string): Promise<number | null> {
  try {
    const res = await fetch(`https://cbu.uz/ru/arkhiv-kursov-valyut/json/${ccy}/`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{ Ccy?: string; Rate?: string }>;
    const row = Array.isArray(arr) ? arr.find((r) => r.Ccy === ccy) ?? arr[0] : null;
    const rate = row?.Rate ? parseFloat(row.Rate) : NaN;
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

/**
 * Refresh the USD/UZS and CNY/UZS rates from the Central Bank of Uzbekistan
 * (cbu.uz). USD drives UZS pricing; CNY lets the import calculator convert
 * supplier quotes. Fired daily by the cron Worker. Idempotent.
 */
async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const [usd, cny] = await Promise.all([fetchCbuRate("USD"), fetchCbuRate("CNY")]);
    if (usd == null) {
      return NextResponse.json({ ok: false, error: "unparseable USD rate" }, { status: 502 });
    }

    const supabase = createServiceClient();
    await setFxRates(supabase, { usd_uzs: usd, cny_uzs: cny ?? undefined });

    // Re-sync stored UZS prices to the fresh rate so they never drift. Fail-open
    // (rate is already saved; a missing RPC / migration must not fail the cron).
    let repriced = 0;
    try {
      const { data: n } = await supabase.rpc("resync_car_uzs", { p_rate: usd });
      repriced = typeof n === "number" ? n : 0;
    } catch {
      // ignore — prices re-sync next run once the function exists
    }

    logEvent("cron.rates", { usd_uzs: usd, cny_uzs: cny, repriced });
    return NextResponse.json({ ok: true, usd_uzs: usd, cny_uzs: cny, repriced });
  } catch (error) {
    reportServerError("GET /api/cron/rates", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
