import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { setUsdUzsRate } from "@/lib/fx-rate";
import { reportServerError } from "@/lib/error-report";

/**
 * Refresh the USD/UZS rate from the Central Bank of Uzbekistan (cbu.uz).
 * Fired daily by the cron Worker. Idempotent — safe to re-run any time.
 */
async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const res = await fetch("https://cbu.uz/ru/arkhiv-kursov-valyut/json/USD/", {
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `cbu.uz ${res.status}` }, { status: 502 });
    }
    const arr = (await res.json()) as Array<{ Ccy?: string; Rate?: string }>;
    const usd = Array.isArray(arr) ? arr.find((r) => r.Ccy === "USD") ?? arr[0] : null;
    const rate = usd?.Rate ? parseFloat(usd.Rate) : NaN;
    if (!Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json({ ok: false, error: "unparseable rate" }, { status: 502 });
    }

    const supabase = createServiceClient();
    await setUsdUzsRate(supabase, rate);
    console.error("cron.rates.ok", JSON.stringify({ event: "cron.rates", usd_uzs: rate }));
    return NextResponse.json({ ok: true, usd_uzs: rate });
  } catch (error) {
    reportServerError("GET /api/cron/rates", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
