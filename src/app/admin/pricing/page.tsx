"use client";

import { useMemo, useState } from "react";
import { Calculator, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  computeLandedPrice,
  priceUsdToUzs,
  PRICING_DEFAULTS,
  type PricingParams,
} from "@/lib/pricing";
import { FALLBACK_USD_UZS } from "@/lib/fx-rate";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

const usd = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-US");
const uzs = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " сум";

const COPY: Record<Locale, {
  title: string; introBefore: string; introAfter: string;
  purchaseCost: string; fxRate: string; freight: string; clearance: string;
  customsDuty: string; excise: string; recyclingFee: string; vat: string;
  margin: string; resetRates: string; recommendedPrice: string;
}> = {
  ru: {
    title: "Ценообразование по полной себестоимости",
    introBefore: "Введите закупочную стоимость и ваши ставки импорта, чтобы получить рекомендованную розничную цену. Эти ставки — настраиваемые оценки, а не налоговая консультация — подгоните их под ваши реальные тарифы. Используйте столбец ",
    introAfter: " в CSV-импорте, чтобы применять это автоматически.",
    purchaseCost: "Закупочная стоимость",
    fxRate: "Курс валют",
    freight: "Фрахт",
    clearance: "Растаможка",
    customsDuty: "Таможенная пошлина",
    excise: "Акциз",
    recyclingFee: "Утилизационный сбор",
    vat: "НДС",
    margin: "Маржа",
    resetRates: "Сбросить ставки",
    recommendedPrice: "Рекомендованная цена",
  },
  uz: {
    title: "To'liq tannarx bo'yicha narxlash",
    introBefore: "Tavsiya etilgan chakana narxni olish uchun xarid qiymati va import stavkalaringizni kiriting. Bu stavkalar — sozlanadigan baholar, soliq maslahati emas — ularni haqiqiy tariflaringizga moslang. Buni avtomatik qo'llash uchun CSV-importda ",
    introAfter: " ustunidan foydalaning.",
    purchaseCost: "Xarid qiymati",
    fxRate: "Valyuta kursi",
    freight: "Fraxt",
    clearance: "Bojxona rasmiylashtiruvi",
    customsDuty: "Bojxona boji",
    excise: "Aksiz",
    recyclingFee: "Utilizatsiya yig'imi",
    vat: "QQS",
    margin: "Marja",
    resetRates: "Stavkalarni tiklash",
    recommendedPrice: "Tavsiya etilgan narx",
  },
  en: {
    title: "Landed-cost pricing",
    introBefore: "Enter a purchase cost and your import rates to get a recommended retail price. These rates are tunable estimates, not tax advice — adjust them to your real tariffs. Use a ",
    introAfter: " column in the CSV import to apply this automatically.",
    purchaseCost: "Purchase cost",
    fxRate: "FX rate",
    freight: "Freight",
    clearance: "Clearance",
    customsDuty: "Customs duty",
    excise: "Excise",
    recyclingFee: "Recycling fee",
    vat: "VAT",
    margin: "Margin",
    resetRates: "Reset rates",
    recommendedPrice: "Recommended price",
  },
};

function NumField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-mono uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
        {label}
        {suffix ? ` (${suffix})` : ""}
      </span>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono"
      />
    </label>
  );
}

export default function AdminPricingPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [cost, setCost] = useState("20000");
  const [rate, setRate] = useState(String(FALLBACK_USD_UZS));
  const [freight, setFreight] = useState(String(PRICING_DEFAULTS.freightUsd));
  const [clearance, setClearance] = useState(String(PRICING_DEFAULTS.clearanceUsd));
  const [duty, setDuty] = useState(String(PRICING_DEFAULTS.dutyPct));
  const [excise, setExcise] = useState(String(PRICING_DEFAULTS.exciseUsd));
  const [recycling, setRecycling] = useState(String(PRICING_DEFAULTS.recyclingUsd));
  const [vat, setVat] = useState(String(PRICING_DEFAULTS.vatPct));
  const [margin, setMargin] = useState(String(PRICING_DEFAULTS.marginPct));

  const num = (s: string, d = 0) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : d;
  };

  const params: Partial<PricingParams> = {
    freightUsd: num(freight),
    clearanceUsd: num(clearance),
    dutyPct: num(duty),
    exciseUsd: num(excise),
    recyclingUsd: num(recycling),
    vatPct: num(vat),
    marginPct: num(margin),
  };

  const result = useMemo(
    () => computeLandedPrice(num(cost), params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cost, freight, clearance, duty, excise, recycling, vat, margin],
  );
  const priceUzs = priceUsdToUzs(result.priceUsd, num(rate, FALLBACK_USD_UZS));

  const reset = () => {
    setFreight(String(PRICING_DEFAULTS.freightUsd));
    setClearance(String(PRICING_DEFAULTS.clearanceUsd));
    setDuty(String(PRICING_DEFAULTS.dutyPct));
    setExcise(String(PRICING_DEFAULTS.exciseUsd));
    setRecycling(String(PRICING_DEFAULTS.recyclingUsd));
    setVat(String(PRICING_DEFAULTS.vatPct));
    setMargin(String(PRICING_DEFAULTS.marginPct));
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-1">
        <Calculator className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {t.introBefore}<span className="font-mono">cost_usd</span>{t.introAfter}
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="bg-card border border-border p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <NumField label={t.purchaseCost} suffix="USD" value={cost} onChange={setCost} />
            <NumField label={t.fxRate} suffix="UZS/USD" value={rate} onChange={setRate} />
            <NumField label={t.freight} suffix="USD" value={freight} onChange={setFreight} />
            <NumField label={t.clearance} suffix="USD" value={clearance} onChange={setClearance} />
            <NumField label={t.customsDuty} suffix="%" value={duty} onChange={setDuty} />
            <NumField label={t.excise} suffix="USD" value={excise} onChange={setExcise} />
            <NumField label={t.recyclingFee} suffix="USD" value={recycling} onChange={setRecycling} />
            <NumField label={t.vat} suffix="%" value={vat} onChange={setVat} />
            <NumField label={t.margin} suffix="%" value={margin} onChange={setMargin} />
          </div>
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="w-4 h-4" /> {t.resetRates}
          </Button>
        </div>

        {/* Result */}
        <div className="bg-card border border-border overflow-hidden">
          <div className="p-5 space-y-2">
            {result.lines.map((l) => (
              <div key={l.key} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <span className="text-muted-foreground">{l.label}</span>
                <span className="font-mono text-foreground">{usd(l.amountUsd)}</span>
              </div>
            ))}
          </div>
          <div className="p-5 bg-primary/[0.08] border-t border-[var(--accent-line)]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-[0.16em] text-primary">{t.recommendedPrice}</span>
              <span className="font-mono text-3xl font-bold text-primary">{usd(result.priceUsd)}</span>
            </div>
            <p className="text-right font-mono text-sm text-muted-foreground mt-1">≈ {uzs(priceUzs)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
