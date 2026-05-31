/**
 * USD/UZS exchange rate, refreshed daily by /api/cron/rates (from cbu.uz) and
 * read by anything that needs to quote UZS (e.g. the Payme deposit checkout).
 *
 * Stored in the dedicated site_settings 'fx_rate' row (migration 018) so the
 * admin "Save settings" — which replaces the singleton row — can't clobber it.
 * Fail-soft: if the row is missing or unreadable, callers get FALLBACK_USD_UZS
 * so a deposit can still be quoted; the cron will correct it on the next run.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const FX_ROW_ID = "fx_rate";
// Conservative default ~ mid-2026 CBU rate; only used until the cron writes a
// real value. Intentionally not zero so downstream UZS math never divides by 0.
export const FALLBACK_USD_UZS = 12600;

export interface FxRate {
  usd_uzs: number;
  updated_at: string | null;
}

/** Read the current USD→UZS rate, falling back to FALLBACK_USD_UZS. */
export async function getUsdUzsRate(supabase: SupabaseClient): Promise<number> {
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("values")
      .eq("id", FX_ROW_ID)
      .maybeSingle();
    const v = data?.values as { usd_uzs?: number } | null | undefined;
    if (v && typeof v.usd_uzs === "number" && v.usd_uzs > 0) return v.usd_uzs;
  } catch {
    // fall through to the fallback
  }
  return FALLBACK_USD_UZS;
}

/** Persist a freshly-fetched USD→UZS rate. */
export async function setUsdUzsRate(
  supabase: SupabaseClient,
  usdUzs: number,
): Promise<void> {
  await supabase
    .from("site_settings")
    .upsert({
      id: FX_ROW_ID,
      values: { usd_uzs: usdUzs, updated_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    });
}
