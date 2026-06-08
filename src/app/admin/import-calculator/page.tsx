"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ship, Loader2, Save, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  computeLandedCost,
  suggestedListPrice,
  marginPctFromPrice,
  FUEL_KINDS,
  DEFAULT_IMPORT_CONFIG,
  type FuelKind,
  type ImportConfig,
  type ImportRates,
  type ImportFees,
} from "@/lib/import-cost";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface Fx {
  usd_uzs: number;
  cny_uzs: number;
  cny_usd: number;
  updated_at: string | null;
}

const FUEL_LABELS: Record<Locale, Record<FuelKind, string>> = {
  ru: {
    petrol: "Бензин",
    diesel: "Дизель",
    hybrid: "Гибрид",
    phev: "Подключаемый гибрид",
    electric: "Электро",
  },
  uz: {
    petrol: "Benzin",
    diesel: "Dizel",
    hybrid: "Gibrid",
    phev: "Plug-in gibrid",
    electric: "Elektr",
  },
  en: {
    petrol: "Petrol",
    diesel: "Diesel",
    hybrid: "Hybrid",
    phev: "Plug-in hybrid",
    electric: "Electric",
  },
};

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const uzs = (n: number) => Math.round(n).toLocaleString("en-US") + " so'm";

const COPY: Record<Locale, {
  title: string; intro: string;
  supplierQuote: string; atCbuRates: (vehicle: string, usdRate: string, cnyRate: string, date: string) => string;
  cbuFallback: string; fuelTypeLabel: string;
  taxRates: (fuel: string) => string; dutyPct: string; excisePct: string; vatPct: string;
  recyclingShort: string; certShort: string;
  logisticsFees: string; freightInsurance: string; clearanceBroker: string;
  inlandLogistics: string; other: string;
  costBreakdown: string; vehiclePrice: string; cifValue: string;
  customsDuty: (pct: number) => string; excise: (pct: number) => string; vat: (pct: number) => string;
  recyclingFee: string; certification: string; landedCost: string; inSom: string;
  suggestedListPrice: string; marginPct: string;
  grossMargin: (perUnit: string, margin: number) => string;
  checkMarginActual: string; checkPlaceholder: string;
  saveAsDefaults: string; saveLandedCostTo: (label: string) => string;
  ratesDisclaimer: string;
  vehicleToUsd: string;
  savedAsDefaults: string; couldNotSave: string;
  savedToCar: (label: string) => string; couldNotSaveCar: string; thisCar: string;
  marketMedian: (label: string, value: string) => string;
}> = {
  ru: {
    title: "Калькулятор импорта",
    intro: "Цена поставщика → реальная себестоимость в Ташкенте → рекомендованная цена продажи. Ставки — это ваши редактируемые допущения, подтвердите их у вашего таможенного брокера.",
    supplierQuote: "Цена поставщика",
    atCbuRates: (vehicle, usdRate, cnyRate, date) => `= ${vehicle} по курсу CBU (USD ${usdRate} · CNY ${cnyRate} so'm · ${date})`,
    cbuFallback: "резервный курс",
    fuelTypeLabel: "Тип топлива (задаёт пошлину/акциз по умолчанию)",
    taxRates: (fuel) => `Налоговые ставки (${fuel})`,
    dutyPct: "Пошлина %",
    excisePct: "Акциз %",
    vatPct: "НДС %",
    recyclingShort: "Утилизация $",
    certShort: "Серт. $",
    logisticsFees: "Логистика и сборы (USD)",
    freightInsurance: "Фрахт + страховка",
    clearanceBroker: "Растаможка / брокер",
    inlandLogistics: "Внутренняя логистика",
    other: "Прочее",
    costBreakdown: "Структура себестоимости (за единицу)",
    vehiclePrice: "Цена авто",
    cifValue: "= Стоимость CIF",
    customsDuty: (pct) => `Таможенная пошлина (${pct}%)`,
    excise: (pct) => `Акциз (${pct}%)`,
    vat: (pct) => `НДС / QQS (${pct}%)`,
    recyclingFee: "Утилизационный сбор",
    certification: "Сертификация",
    landedCost: "Полная себестоимость",
    inSom: "в сумах",
    suggestedListPrice: "Рекомендованная цена",
    marginPct: "маржа %",
    grossMargin: (perUnit, margin) => `Валовая маржа ≈ ${perUnit} / ед. при ${margin}% сверх полной себестоимости.`,
    checkMarginActual: "Проверить маржу при фактической цене (USD)",
    checkPlaceholder: "напр. 43000",
    saveAsDefaults: "Сохранить как настройки по умолчанию",
    saveLandedCostTo: (label) => `Сохранить себестоимость в ${label}`,
    ratesDisclaimer: "Эти ставки — редактируемые допущения, а не юридическая консультация. Пошлины/акцизы/сборы Узбекистана меняются и зависят от типа импортёра, объёма двигателя, возраста и топлива — уточняйте актуальные цифры.",
    vehicleToUsd: "→ USD",
    savedAsDefaults: "Сохранено как настройки по умолчанию для будущих расчётов.",
    couldNotSave: "Не удалось сохранить — проверьте значения.",
    savedToCar: (label) => `Себестоимость сохранена в ${label}.`,
    couldNotSaveCar: "Не удалось сохранить в авто.",
    thisCar: "это авто",
    marketMedian: (label, value) => `${label} · медиана рынка $${value}`,
  },
  uz: {
    title: "Import kalkulyatori",
    intro: "Yetkazib beruvchi narxi → Toshkentdagi haqiqiy tannarx → tavsiya etilgan sotuv narxi. Stavkalar — bu sizning tahrirlanadigan taxminlaringiz, ularni bojxona brokeringiz bilan tasdiqlang.",
    supplierQuote: "Yetkazib beruvchi narxi",
    atCbuRates: (vehicle, usdRate, cnyRate, date) => `= ${vehicle} CBU kursi bo'yicha (USD ${usdRate} · CNY ${cnyRate} so'm · ${date})`,
    cbuFallback: "zaxira kurs",
    fuelTypeLabel: "Yoqilg'i turi (standart boj/aksizni belgilaydi)",
    taxRates: (fuel) => `Soliq stavkalari (${fuel})`,
    dutyPct: "Boj %",
    excisePct: "Aksiz %",
    vatPct: "QQS %",
    recyclingShort: "Utilizatsiya $",
    certShort: "Sert. $",
    logisticsFees: "Logistika va yig'imlar (USD)",
    freightInsurance: "Fraxt + sug'urta",
    clearanceBroker: "Rasmiylashtirish / broker",
    inlandLogistics: "Ichki logistika",
    other: "Boshqa",
    costBreakdown: "Tannarx tarkibi (bir dona uchun)",
    vehiclePrice: "Avtomobil narxi",
    cifValue: "= CIF qiymati",
    customsDuty: (pct) => `Bojxona boji (${pct}%)`,
    excise: (pct) => `Aksiz (${pct}%)`,
    vat: (pct) => `QQS (${pct}%)`,
    recyclingFee: "Utilizatsiya yig'imi",
    certification: "Sertifikatsiya",
    landedCost: "To'liq tannarx",
    inSom: "so'mda",
    suggestedListPrice: "Tavsiya etilgan narx",
    marginPct: "marja %",
    grossMargin: (perUnit, margin) => `Yalpi marja ≈ ${perUnit} / dona, to'liq tannarx ustiga ${margin}%.`,
    checkMarginActual: "Haqiqiy narxda marjani tekshiring (USD)",
    checkPlaceholder: "masalan, 43000",
    saveAsDefaults: "Standart sozlama sifatida saqlash",
    saveLandedCostTo: (label) => `Tannarxni ${label} ga saqlash`,
    ratesDisclaimer: "Bu stavkalar — tahrirlanadigan taxminlar, yuridik maslahat emas. O'zbekistonning boj/aksiz/yig'imlari o'zgaradi va importyor turi, dvigatel hajmi, yoshi va yoqilg'isiga bog'liq — joriy raqamlarni tasdiqlang.",
    vehicleToUsd: "→ USD",
    savedAsDefaults: "Kelgusi hisob-kitoblar uchun standart sifatida saqlandi.",
    couldNotSave: "Saqlab bo'lmadi — qiymatlarni tekshiring.",
    savedToCar: (label) => `Tannarx ${label} ga saqlandi.`,
    couldNotSaveCar: "Avtomobilga saqlab bo'lmadi.",
    thisCar: "ushbu avtomobil",
    marketMedian: (label, value) => `${label} · bozor mediani $${value}`,
  },
  en: {
    title: "Import calculator",
    intro: "Supplier price → true landed cost in Tashkent → suggested list price. Rates are your editable assumptions — confirm them with your customs broker.",
    supplierQuote: "Supplier quote",
    atCbuRates: (vehicle, usdRate, cnyRate, date) => `= ${vehicle} at CBU rates (USD ${usdRate} · CNY ${cnyRate} so'm · ${date})`,
    cbuFallback: "fallback",
    fuelTypeLabel: "Fuel type (sets default duty/excise)",
    taxRates: (fuel) => `Tax rates (${fuel})`,
    dutyPct: "Duty %",
    excisePct: "Excise %",
    vatPct: "VAT %",
    recyclingShort: "Recycling $",
    certShort: "Cert. $",
    logisticsFees: "Logistics & fees (USD)",
    freightInsurance: "Freight + insurance",
    clearanceBroker: "Clearance / broker",
    inlandLogistics: "Inland logistics",
    other: "Other",
    costBreakdown: "Cost breakdown (per unit)",
    vehiclePrice: "Vehicle price",
    cifValue: "= CIF value",
    customsDuty: (pct) => `Customs duty (${pct}%)`,
    excise: (pct) => `Excise (${pct}%)`,
    vat: (pct) => `VAT / QQS (${pct}%)`,
    recyclingFee: "Recycling / util. fee",
    certification: "Certification",
    landedCost: "Landed cost",
    inSom: "in so'm",
    suggestedListPrice: "Suggested list price",
    marginPct: "margin %",
    grossMargin: (perUnit, margin) => `Gross margin ≈ ${perUnit} / unit at ${margin}% over landed cost.`,
    checkMarginActual: "Check margin at an actual list price (USD)",
    checkPlaceholder: "e.g. 43000",
    saveAsDefaults: "Save as defaults",
    saveLandedCostTo: (label) => `Save landed cost to ${label}`,
    ratesDisclaimer: "These rates are editable assumptions, not legal advice. Uzbekistan's duties/excise/fees change and depend on importer type, engine volume, age and fuel — confirm the live figures.",
    vehicleToUsd: "→ USD",
    savedAsDefaults: "Saved as defaults for future calculations.",
    couldNotSave: "Could not save — check the values.",
    savedToCar: (label) => `Saved landed cost to ${label}.`,
    couldNotSaveCar: "Could not save to car.",
    thisCar: "this car",
    marketMedian: (label, value) => `${label} · market median $${value}`,
  },
};

export default function ImportCalculatorPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const fuelLabels = FUEL_LABELS[locale];
  const [config, setConfig] = useState<ImportConfig>(DEFAULT_IMPORT_CONFIG);
  const [fx, setFx] = useState<Fx>({ usd_uzs: 12600, cny_uzs: 1750, cny_usd: 0.1389, updated_at: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Inputs
  const [supplierPrice, setSupplierPrice] = useState(120000);
  const [currency, setCurrency] = useState<"CNY" | "USD">("CNY");
  const [fuel, setFuel] = useState<FuelKind>("electric");
  const [rates, setRates] = useState<ImportRates>(DEFAULT_IMPORT_CONFIG.rates.electric);
  const [fees, setFees] = useState<ImportFees>(DEFAULT_IMPORT_CONFIG.fees);
  const [margin, setMargin] = useState(DEFAULT_IMPORT_CONFIG.targetMarginPct);
  const [listPrice, setListPrice] = useState(0); // for margin-on-actual-price

  // For optional "save to car" wiring (?car_id=&car_label=)
  const [carId, setCarId] = useState<string | null>(null);
  const [carLabel, setCarLabel] = useState<string>("");
  // Optional market-price prefill from the Market page (?market=&brand=&model=&year=)
  const [marketLabel, setMarketLabel] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/import-config");
      const data = await res.json();
      if (data.config) {
        setConfig(data.config);
        setFees(data.config.fees);
        setMargin(data.config.targetMarginPct);
        setRates(data.config.rates[fuel] ?? data.config.rates.electric);
      }
      if (data.fx) setFx(data.fx);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const id = p.get("car_id");
    if (id) {
      setCarId(id);
      setCarLabel(p.get("car_label") || t.thisCar);
    }
    const market = p.get("market");
    if (market && Number(market) > 0) {
      setListPrice(Number(market));
      const label = [p.get("brand"), p.get("model"), p.get("year")].filter(Boolean).join(" ");
      setMarketLabel(label ? t.marketMedian(label, Number(market).toLocaleString("en-US")) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switching fuel resets the working rates to that fuel's saved defaults.
  useEffect(() => {
    setRates(config.rates[fuel]);
  }, [fuel, config]);

  const vehicleUsd = useMemo(
    () => (currency === "USD" ? supplierPrice : supplierPrice * fx.cny_usd),
    [supplierPrice, currency, fx.cny_usd],
  );

  const breakdown = useMemo(
    () =>
      computeLandedCost({
        vehiclePriceUsd: vehicleUsd,
        freightUsd: fees.freightUsd,
        clearanceUsd: fees.clearanceUsd,
        inlandLogisticsUsd: fees.inlandLogisticsUsd,
        otherUsd: fees.otherUsd,
        rates,
      }),
    [vehicleUsd, fees, rates],
  );

  const suggested = useMemo(() => suggestedListPrice(breakdown.landedCostUsd, margin), [breakdown.landedCostUsd, margin]);
  const actualMarginPct = useMemo(
    () => (listPrice > 0 ? marginPctFromPrice(breakdown.landedCostUsd, listPrice) : null),
    [breakdown.landedCostUsd, listPrice],
  );

  const saveDefaults = async () => {
    setSaving(true);
    setNote(null);
    try {
      const next: ImportConfig = {
        ...config,
        rates: { ...config.rates, [fuel]: rates },
        fees,
        targetMarginPct: margin,
      };
      const res = await fetch("/api/admin/import-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (res.ok) {
        setConfig(next);
        setNote(t.savedAsDefaults);
      } else {
        setNote(t.couldNotSave);
      }
    } finally {
      setSaving(false);
    }
  };

  const saveToCar = async () => {
    if (!carId) return;
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch(`/api/admin/cars/${carId}/cost`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cost_usd: Math.round(breakdown.landedCostUsd) }),
      });
      setNote(res.ok ? t.savedToCar(carLabel) : t.couldNotSaveCar);
    } finally {
      setSaving(false);
    }
  };

  const lines: { label: string; value: number; hint?: string }[] = [
    { label: t.vehiclePrice, value: breakdown.vehiclePriceUsd, hint: currency === "CNY" ? `¥${supplierPrice.toLocaleString()} ${t.vehicleToUsd}` : undefined },
    { label: t.freightInsurance, value: breakdown.freightUsd },
    { label: t.cifValue, value: breakdown.cifUsd },
    { label: t.customsDuty(rates.customsDutyPct), value: breakdown.customsDutyUsd },
    { label: t.excise(rates.excisePct), value: breakdown.exciseUsd },
    { label: t.vat(rates.vatPct), value: breakdown.vatUsd },
    { label: t.recyclingFee, value: breakdown.recyclingFeeUsd },
    { label: t.certification, value: breakdown.certificationUsd },
    { label: t.clearanceBroker, value: breakdown.clearanceUsd },
    { label: t.inlandLogistics, value: breakdown.inlandLogisticsUsd },
    { label: t.other, value: breakdown.otherUsd },
  ];

  const numInput = (val: number, set: (n: number) => void, opts: { step?: number } = {}) => (
    <Input
      type="number"
      value={Number.isFinite(val) ? val : 0}
      step={opts.step}
      onChange={(e) => set(e.target.value === "" ? 0 : Number(e.target.value))}
      className="text-sm"
    />
  );

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <Ship className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {t.intro}
      </p>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* ---- Inputs ---- */}
          <div className="space-y-5">
            <div className="bg-card border border-border p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">{t.supplierQuote}</h2>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                {numInput(supplierPrice, setSupplierPrice, { step: 1000 })}
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as "CNY" | "USD")}
                  className="h-11 rounded-[2px] border border-border bg-[var(--bg-3)] px-3 text-sm text-foreground"
                >
                  <option value="CNY">CNY ¥</option>
                  <option value="USD">USD $</option>
                </select>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t.atCbuRates(usd(vehicleUsd), fx.usd_uzs.toLocaleString(), fx.cny_uzs.toLocaleString(), fx.updated_at ? fx.updated_at.slice(0, 10) : t.cbuFallback)}
              </p>
              <div>
                <label className="text-xs text-muted-foreground">{t.fuelTypeLabel}</label>
                <select
                  value={fuel}
                  onChange={(e) => setFuel(e.target.value as FuelKind)}
                  className="mt-1 w-full h-11 rounded-[2px] border border-border bg-[var(--bg-3)] px-3 text-sm text-foreground"
                >
                  {FUEL_KINDS.map((f) => (
                    <option key={f} value={f}>{fuelLabels[f]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-card border border-border p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">{t.taxRates(fuelLabels[fuel])}</h2>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-[11px] text-muted-foreground">{t.dutyPct}</label>{numInput(rates.customsDutyPct, (n) => setRates({ ...rates, customsDutyPct: n }))}</div>
                <div><label className="text-[11px] text-muted-foreground">{t.excisePct}</label>{numInput(rates.excisePct, (n) => setRates({ ...rates, excisePct: n }))}</div>
                <div><label className="text-[11px] text-muted-foreground">{t.vatPct}</label>{numInput(rates.vatPct, (n) => setRates({ ...rates, vatPct: n }))}</div>
                <div><label className="text-[11px] text-muted-foreground">{t.recyclingShort}</label>{numInput(rates.recyclingFeeUsd, (n) => setRates({ ...rates, recyclingFeeUsd: n }))}</div>
                <div><label className="text-[11px] text-muted-foreground">{t.certShort}</label>{numInput(rates.certificationUsd, (n) => setRates({ ...rates, certificationUsd: n }))}</div>
              </div>
            </div>

            <div className="bg-card border border-border p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">{t.logisticsFees}</h2>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[11px] text-muted-foreground">{t.freightInsurance}</label>{numInput(fees.freightUsd, (n) => setFees({ ...fees, freightUsd: n }), { step: 100 })}</div>
                <div><label className="text-[11px] text-muted-foreground">{t.clearanceBroker}</label>{numInput(fees.clearanceUsd, (n) => setFees({ ...fees, clearanceUsd: n }), { step: 50 })}</div>
                <div><label className="text-[11px] text-muted-foreground">{t.inlandLogistics}</label>{numInput(fees.inlandLogisticsUsd, (n) => setFees({ ...fees, inlandLogisticsUsd: n }), { step: 50 })}</div>
                <div><label className="text-[11px] text-muted-foreground">{t.other}</label>{numInput(fees.otherUsd, (n) => setFees({ ...fees, otherUsd: n }), { step: 50 })}</div>
              </div>
            </div>
          </div>

          {/* ---- Results ---- */}
          <div className="space-y-5">
            <div className="bg-card border border-border p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">{t.costBreakdown}</h2>
              <table className="w-full text-sm">
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.label} className="border-b border-border/60 last:border-0">
                      <td className="py-1.5 text-muted-foreground">
                        {l.label}{l.hint && <span className="text-[11px] opacity-70"> · {l.hint}</span>}
                      </td>
                      <td className="py-1.5 text-right font-mono text-foreground">{usd(l.value)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border">
                    <td className="py-2 font-semibold text-foreground">{t.landedCost}</td>
                    <td className="py-2 text-right font-mono font-semibold text-foreground">{usd(breakdown.landedCostUsd)}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-[11px] text-muted-foreground">{t.inSom}</td>
                    <td className="py-0.5 text-right font-mono text-[11px] text-muted-foreground">{uzs(breakdown.landedCostUsd * fx.usd_uzs)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-card border border-border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">{t.suggestedListPrice}</h2>
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] text-muted-foreground">{t.marginPct}</label>
                  <Input type="number" value={margin} onChange={(e) => setMargin(e.target.value === "" ? 0 : Number(e.target.value))} className="w-20 h-9 text-sm" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold text-primary">{usd(suggested)}</span>
                <span className="text-xs text-muted-foreground">{uzs(suggested * fx.usd_uzs)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t.grossMargin(usd(suggested - breakdown.landedCostUsd), margin)}
              </p>

              <div className="pt-2 border-t border-border">
                <label className="text-[11px] text-muted-foreground">
                  {t.checkMarginActual}
                  {marketLabel && <span className="text-primary"> · {marketLabel}</span>}
                </label>
                <div className="flex items-center gap-3 mt-1">
                  <Input type="number" value={listPrice || ""} placeholder={t.checkPlaceholder} onChange={(e) => setListPrice(e.target.value === "" ? 0 : Number(e.target.value))} className="w-40 text-sm" />
                  {actualMarginPct != null && (
                    <span className={`text-sm font-mono ${actualMarginPct >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                      {actualMarginPct >= 0 ? "+" : ""}{actualMarginPct}% · {usd(listPrice - breakdown.landedCostUsd)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={saveDefaults} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> {t.saveAsDefaults}</>}
              </Button>
              {carId && (
                <Button size="sm" onClick={saveToCar} disabled={saving}>
                  {t.saveLandedCostTo(carLabel)}
                </Button>
              )}
              {note && <span className="text-xs text-primary">{note}</span>}
            </div>

            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Info className="w-3.5 h-3.5 mt-px shrink-0" />
              {t.ratesDisclaimer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
