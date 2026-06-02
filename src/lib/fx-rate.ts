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
// Conservative defaults ~ mid-2026 CBU rates; only used until the cron writes
// real values. Intentionally not zero so downstream FX math never divides by 0.
export const FALLBACK_USD_UZS = 12600;
export const FALLBACK_CNY_UZS = 1750; // ~ USD/CNY 7.2 → CNY/UZS ≈ 12600/7.2

export interface FxRate {
  usd_uzs: number;
  cny_uzs: number;
  updated_at: string | null;
}

interface FxValues {
  usd_uzs?: number;
  cny_uzs?: number;
  updated_at?: string;
}

async function readFx(supabase: SupabaseClient): Promise<FxValues | null> {
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("values")
      .eq("id", FX_ROW_ID)
      .maybeSingle();
    return (data?.values as FxValues | null | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Read the current USD→UZS rate, falling back to FALLBACK_USD_UZS. */
export async function getUsdUzsRate(supabase: SupabaseClient): Promise<number> {
  const v = await readFx(supabase);
  if (v && typeof v.usd_uzs === "number" && v.usd_uzs > 0) return v.usd_uzs;
  return FALLBACK_USD_UZS;
}

/** Read the current CNY→UZS rate, falling back to FALLBACK_CNY_UZS. */
export async function getCnyUzsRate(supabase: SupabaseClient): Promise<number> {
  const v = await readFx(supabase);
  if (v && typeof v.cny_uzs === "number" && v.cny_uzs > 0) return v.cny_uzs;
  return FALLBACK_CNY_UZS;
}

/** Read both rates plus the derived CNY→USD cross-rate in one round-trip. */
export async function getFxRates(
  supabase: SupabaseClient,
): Promise<{ usd_uzs: number; cny_uzs: number; cny_usd: number; updated_at: string | null }> {
  const v = await readFx(supabase);
  const usd_uzs = v && typeof v.usd_uzs === "number" && v.usd_uzs > 0 ? v.usd_uzs : FALLBACK_USD_UZS;
  const cny_uzs = v && typeof v.cny_uzs === "number" && v.cny_uzs > 0 ? v.cny_uzs : FALLBACK_CNY_UZS;
  return { usd_uzs, cny_uzs, cny_usd: cny_uzs / usd_uzs, updated_at: v?.updated_at ?? null };
}

/** Convert a CNY (yuan) amount to USD via the two CBU rates. */
export function cnyToUsd(amountCny: number, cnyUzs: number, usdUzs: number): number {
  if (!(usdUzs > 0)) return 0;
  return (Number.isFinite(amountCny) ? amountCny : 0) * (cnyUzs / usdUzs);
}

/** Persist freshly-fetched rates. Merges so a partial update keeps the other. */
export async function setFxRates(
  supabase: SupabaseClient,
  rates: { usd_uzs?: number; cny_uzs?: number },
): Promise<void> {
  const current = (await readFx(supabase)) ?? {};
  await supabase.from("site_settings").upsert({
    id: FX_ROW_ID,
    values: {
      usd_uzs: rates.usd_uzs ?? current.usd_uzs,
      cny_uzs: rates.cny_uzs ?? current.cny_uzs,
      updated_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  });
}

/** Back-compat: persist just the USD→UZS rate. */
export async function setUsdUzsRate(supabase: SupabaseClient, usdUzs: number): Promise<void> {
  await setFxRates(supabase, { usd_uzs: usdUzs });
}
