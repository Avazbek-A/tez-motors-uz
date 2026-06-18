/**
 * LEGAL BASIS + PROVENANCE for the UZ customs rate model (customs-uz.ts).
 *
 * Leap 1 ("base it on current legislation, not a 2-year-old competitor bot"):
 * this file grounds every rate in a citable source — the Cabinet of Ministers
 * resolution (ПКМ) and the official tariff — with an effective date, so a quote
 * is defensible and we know WHEN the basis was last confirmed. customs-uz.ts
 * stays the compute engine; this is the citation + confidence layer that the UI
 * surfaces and the monthly drift-watch (deploy/collector/customs-drift.mjs)
 * checks against the live @autodeklarantbot + tarif.customs.uz.
 *
 * Sources are verifiable on lex.uz (by resolution number) and tarif.customs.uz
 * (by ТН ВЭД code). Rate VALUES live in customs-uz.ts; this records their basis.
 */
export interface RateCitation { what: string; law: string; note?: string }

export const CUSTOMS_RATES = {
  /** When the legal basis below was last confirmed. Bump on each verification. */
  confirmedAt: "2025-08",
  brvSum: 412_000, // БХМ (базовая расчётная величина), Aug 2025
  citations: [
    { what: "БХМ (base value) = 412 000 сум", law: "Установлена ежегодно; значение на 08.2025" },
    { what: "Утилизационный сбор (по объёму/возрасту; EV ≤3 г — 120 БХМ, >3 г — 210 БХМ с 01.05.2025)", law: "ПКМ РУз №358 от 09.06.2021 (с изм. 05.2025)" },
    { what: "Таможенный сбор за оформление = 2.5 БХМ", law: "ПКМ РУз №55 от 31.01.2025" },
    { what: "НДС 12% от (стоимость + пошлина + акциз)", law: "Налоговый кодекс РУз" },
    { what: "Таможенная пошлина (по возрасту, объёму, происхождению/СТ-1)", law: "Таможенный тариф РУз — tarif.customs.uz по коду ТН ВЭД" },
  ] as RateCitation[],
  /**
   * Cells where our bot-derived matrix may DIVERGE from statute — surfaced
   * honestly + watched. Resolve against the live tariff / lex.uz before treating
   * as authoritative.
   */
  needsReview: [
    {
      cell: "No-certificate duty ×2 (e.g. >3y → 80% + $6/cm³)",
      note: "Secondary sources cite '>3 лет без СТ-1 = 40% + $3/см³' — i.e. our 'certified non-FTA' rate. СТ-1 is the FTA/CIS ORIGIN certificate (preferential → 0%), not a generic doc. The extra ×2 'no-certificate' penalty comes from @autodeklarantbot and is unconfirmed against the current tariff — verify before relying on it.",
    },
  ] as { cell: string; note: string }[],
};

/** Localized one-line legal-basis footnote for the calculator UI. */
export function legalBasisNote(locale: string): string {
  const d = CUSTOMS_RATES.confirmedAt;
  if (locale === "uz") return `Tariflar OʻzR qonunchiligiga asoslangan (BHM 412 000 soʻm; utilizatsiya — VMQ №358; yigʻim — VMQ №55). Holatga: ${d}.`;
  if (locale === "en") return `Rates per current UZ law (BRV 412,000; utilization — CMR №358; fee — CMR №55). Confirmed: ${d}.`;
  return `Тарифы по действующему законодательству РУз (БХМ 412 000 сум; утильсбор — ПКМ №358; сбор — ПКМ №55). Актуально на: ${d}.`;
}
