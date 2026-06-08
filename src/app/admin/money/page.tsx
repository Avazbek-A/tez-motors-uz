"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Banknote, Loader2, ArrowRight } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface MoneyData {
  ok: boolean;
  fx: { usd_uzs: number; cny_uzs: number; cny_usd: number; updated_at: string | null };
  inventory: {
    onLotCount: number;
    soldCount: number;
    atCostUsd: number;
    listValueUsd: number;
    potentialMarginUsd: number;
    realizedMarginUsd: number;
  };
  cash: { depositsCollectedUzs: number; depositsCollectedUsd: number };
  suppliers: {
    committedUsd: number;
    pipelineUsd: number;
    byStatus: Record<string, { count: number; valueUsd: number }>;
  };
  exposure: { usdAtRisk: number; uzsNow: number; uzsAtMinus5pct: number };
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const uzs = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " so'm";

const PO_STATUS_ORDER = ["draft", "ordered", "in_production", "shipped", "arrived", "cancelled"];
const PO_TONE: Record<string, string> = {
  draft: "text-muted-foreground",
  ordered: "text-[var(--info)]",
  in_production: "text-[var(--warning)]",
  shipped: "text-primary",
  arrived: "text-[var(--success)]",
  cancelled: "text-[var(--danger)]",
};

const COPY: Record<Locale, {
  title: string;
  intro: string;
  noData: string;
  depositsCollected: string;
  committedToSuppliers: string;
  committedSub: string;
  inventoryAtCost: string;
  carsOnLot: (n: number) => string;
  potentialMargin: string;
  potentialMarginSub: string;
  realizedMargin: string;
  realizedMarginSub: (n: number) => string;
  inventoryListValue: string;
  inventoryListValueSub: string;
  supplierPipeline: string;
  supplierPipelineSub: string;
  supplierCapitalTitle: string;
  colStatus: string;
  colOrders: string;
  colValueUsd: string;
  noPosBefore: string;
  noPosLink: string;
  noPosAfter: string;
  fxRatesTitle: string;
  usdToUzs: string;
  cnyToUzs: string;
  cnyToUsd: string;
  updatedPrefix: string;
  fallbackRates: string;
  fxExposureTitle: string;
  fxExposureIntro: string;
  atRisk: string;
  equalsNow: string;
  ifSoumMinus5: string;
  fxExposureNote: (amount: string) => string;
  perCarLedger: string;
}> = {
  ru: {
    title: "Денежная панель",
    intro: "Где сейчас ваш капитал — собранная наличность, обязательства поставщикам, запасы на складе и нереализованная против реализованной маржи. Отслеживаемые авто + открытые заказы на закупку + депозиты.",
    noData: "Финансовых данных пока нет.",
    depositsCollected: "Собрано депозитов",
    committedToSuppliers: "Обязательства поставщикам",
    committedSub: "открытые заказы в пути",
    inventoryAtCost: "Запасы по себестоимости",
    carsOnLot: (n) => `${n} авто на складе`,
    potentialMargin: "Потенциальная маржа",
    potentialMarginSub: "нереализованная, на складе",
    realizedMargin: "Реализованная маржа",
    realizedMarginSub: (n) => `продано: ${n}`,
    inventoryListValue: "Стоимость запасов по прайсу",
    inventoryListValueSub: "по прайсовой цене",
    supplierPipeline: "Воронка поставщиков",
    supplierPipelineSub: "черновые заказы, без обязательств",
    supplierCapitalTitle: "Капитал поставщиков по статусу заказа на закупку",
    colStatus: "Статус",
    colOrders: "Заказы",
    colValueUsd: "Сумма (USD)",
    noPosBefore: "Заказов на закупку пока нет — ",
    noPosLink: "создать",
    noPosAfter: ".",
    fxRatesTitle: "Курсы валют (ЦБ РУз)",
    usdToUzs: "USD → UZS",
    cnyToUzs: "CNY → UZS",
    cnyToUsd: "CNY → USD",
    updatedPrefix: "Обновлено",
    fallbackRates: "Используются запасные курсы — ежедневный крон обновит их.",
    fxExposureTitle: "Валютный риск",
    fxExposureIntro: "Вы покупаете в USD/CNY и продаёте в сумах. Капитал, обязательства по которому ещё не поступили:",
    atRisk: "Под риском",
    equalsNow: "= сейчас",
    ifSoumMinus5: "если сум −5%",
    fxExposureNote: (amount) => `Девальвация сума на 5% добавляет ${amount} к стоимости этого импорта в местной валюте.`,
    perCarLedger: "Журнал прибыли по каждому авто",
  },
  uz: {
    title: "Pul paneli",
    intro: "Kapitalingiz hozir qayerda — yig'ilgan naqd pul, ta'minotchilarga majburiyatlar, omborda turgan zaxiralar va amalga oshmagan hamda amalga oshirilgan marja. Kuzatilayotgan avtomobillar + ochiq xarid buyurtmalari + depozitlar.",
    noData: "Hozircha moliyaviy ma'lumotlar yo'q.",
    depositsCollected: "Yig'ilgan depozitlar",
    committedToSuppliers: "Ta'minotchilarga majburiyatlar",
    committedSub: "yo'ldagi ochiq buyurtmalar",
    inventoryAtCost: "Zaxiralar tannarxi bo'yicha",
    carsOnLot: (n) => `omborda ${n} avtomobil`,
    potentialMargin: "Potentsial marja",
    potentialMarginSub: "amalga oshmagan, omborda",
    realizedMargin: "Amalga oshirilgan marja",
    realizedMarginSub: (n) => `sotilgan: ${n}`,
    inventoryListValue: "Zaxiralar narxlar bo'yicha qiymati",
    inventoryListValueSub: "narxnoma bo'yicha",
    supplierPipeline: "Ta'minotchilar voronkasi",
    supplierPipelineSub: "qoralama buyurtmalar, majburiyatsiz",
    supplierCapitalTitle: "Ta'minotchilar kapitali xarid buyurtmasi holati bo'yicha",
    colStatus: "Holat",
    colOrders: "Buyurtmalar",
    colValueUsd: "Summa (USD)",
    noPosBefore: "Hozircha xarid buyurtmalari yo'q — ",
    noPosLink: "yaratish",
    noPosAfter: ".",
    fxRatesTitle: "Valyuta kurslari (O'zR MB)",
    usdToUzs: "USD → UZS",
    cnyToUzs: "CNY → UZS",
    cnyToUsd: "CNY → USD",
    updatedPrefix: "Yangilangan",
    fallbackRates: "Zaxira kurslar ishlatilmoqda — kunlik kron ularni yangilaydi.",
    fxExposureTitle: "Valyuta xavfi",
    fxExposureIntro: "Siz USD/CNY da sotib olasiz va so'mda sotasiz. Majburiyatlari hali kelib tushmagan kapital:",
    atRisk: "Xavf ostida",
    equalsNow: "= hozir",
    ifSoumMinus5: "agar so'm −5%",
    fxExposureNote: (amount) => `So'mning 5% devalvatsiyasi ushbu importning mahalliy valyutadagi qiymatiga ${amount} qo'shadi.`,
    perCarLedger: "Har bir avtomobil bo'yicha foyda jurnali",
  },
  en: {
    title: "Money cockpit",
    intro: "Where your capital is right now — cash collected, committed to suppliers, sitting as stock, and your unrealized vs realized margin. Tracked cars + open purchase orders + deposits.",
    noData: "No financial data yet.",
    depositsCollected: "Deposits collected",
    committedToSuppliers: "Committed to suppliers",
    committedSub: "open POs in transit",
    inventoryAtCost: "Inventory at cost",
    carsOnLot: (n) => `${n} cars on lot`,
    potentialMargin: "Potential margin",
    potentialMarginSub: "unrealized, on lot",
    realizedMargin: "Realized margin",
    realizedMarginSub: (n) => `${n} sold`,
    inventoryListValue: "Inventory list value",
    inventoryListValueSub: "at sticker price",
    supplierPipeline: "Supplier pipeline",
    supplierPipelineSub: "draft POs, not committed",
    supplierCapitalTitle: "Supplier capital by purchase-order status",
    colStatus: "Status",
    colOrders: "Orders",
    colValueUsd: "Value (USD)",
    noPosBefore: "No purchase orders yet — ",
    noPosLink: "create one",
    noPosAfter: ".",
    fxRatesTitle: "Exchange rates (CBU)",
    usdToUzs: "USD → UZS",
    cnyToUzs: "CNY → UZS",
    cnyToUsd: "CNY → USD",
    updatedPrefix: "Updated",
    fallbackRates: "Using fallback rates — the daily rates cron will refresh them.",
    fxExposureTitle: "FX exposure",
    fxExposureIntro: "You buy in USD/CNY and sell in so'm. Capital committed to suppliers that hasn't landed yet:",
    atRisk: "At risk",
    equalsNow: "= now",
    ifSoumMinus5: "if so'm −5%",
    fxExposureNote: (amount) => `A 5% soum depreciation adds ${amount} to what those imports cost you in local money.`,
    perCarLedger: "Per-car profit ledger",
  },
};

export default function AdminMoneyPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [data, setData] = useState<MoneyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats/money")
      .then((r) => r.json())
      .then((d) => setData(d && d.ok ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <Banknote className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {t.intro}
      </p>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">{t.noData}</p>
      ) : (
        <div className="space-y-8">
          {/* Headline cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: t.depositsCollected, value: uzs(data.cash.depositsCollectedUzs), sub: `≈ ${usd(data.cash.depositsCollectedUsd)}` },
              { label: t.committedToSuppliers, value: usd(data.suppliers.committedUsd), sub: t.committedSub },
              { label: t.inventoryAtCost, value: usd(data.inventory.atCostUsd), sub: t.carsOnLot(data.inventory.onLotCount) },
              { label: t.potentialMargin, value: usd(data.inventory.potentialMarginUsd), sub: t.potentialMarginSub, accent: true },
              { label: t.realizedMargin, value: usd(data.inventory.realizedMarginUsd), sub: t.realizedMarginSub(data.inventory.soldCount), accent: true },
              { label: t.inventoryListValue, value: usd(data.inventory.listValueUsd), sub: t.inventoryListValueSub },
              { label: t.supplierPipeline, value: usd(data.suppliers.pipelineUsd), sub: t.supplierPipelineSub },
            ].map((c) => (
              <div key={c.label} className="bg-card border border-border p-4">
                <p className={`font-mono text-xl font-semibold ${c.accent ? "text-primary" : "text-foreground"}`}>{c.value}</p>
                <p className="text-xs text-foreground mt-1">{c.label}</p>
                {c.sub && <p className="text-[11px] text-muted-foreground">{c.sub}</p>}
              </div>
            ))}
          </div>

          {/* Supplier capital by PO status */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">{t.supplierCapitalTitle}</h2>
            <div className="bg-card border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="px-4 py-2 font-medium">{t.colStatus}</th>
                    <th className="px-4 py-2 font-medium text-right">{t.colOrders}</th>
                    <th className="px-4 py-2 font-medium text-right">{t.colValueUsd}</th>
                  </tr>
                </thead>
                <tbody>
                  {PO_STATUS_ORDER.filter((s) => data.suppliers.byStatus[s]).map((s) => (
                    <tr key={s} className="border-b border-border last:border-0">
                      <td className={`px-4 py-2.5 font-mono uppercase text-xs ${PO_TONE[s]}`}>{s.replace("_", " ")}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{data.suppliers.byStatus[s].count}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-foreground">{usd(data.suppliers.byStatus[s].valueUsd)}</td>
                    </tr>
                  ))}
                  {Object.keys(data.suppliers.byStatus).length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground text-sm">{t.noPosBefore}<Link href="/admin/procurement" className="text-primary hover:underline">{t.noPosLink}</Link>{t.noPosAfter}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* FX + exposure */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-card border border-border p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">{t.fxRatesTitle}</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">{t.usdToUzs}</dt><dd className="font-mono text-foreground">{data.fx.usd_uzs.toLocaleString()}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">{t.cnyToUzs}</dt><dd className="font-mono text-foreground">{data.fx.cny_uzs.toLocaleString()}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">{t.cnyToUsd}</dt><dd className="font-mono text-foreground">{data.fx.cny_usd.toFixed(4)}</dd></div>
              </dl>
              <p className="text-[11px] text-muted-foreground mt-3">
                {data.fx.updated_at ? `${t.updatedPrefix} ${data.fx.updated_at.slice(0, 10)}` : t.fallbackRates}
              </p>
            </div>

            <div className="bg-card border border-border p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">{t.fxExposureTitle}</h2>
              <p className="text-sm text-muted-foreground mb-2">
                {t.fxExposureIntro}
              </p>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">{t.atRisk}</dt><dd className="font-mono text-foreground">{usd(data.exposure.usdAtRisk)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">{t.equalsNow}</dt><dd className="font-mono text-foreground">{uzs(data.exposure.uzsNow)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">{t.ifSoumMinus5}</dt><dd className="font-mono text-[var(--danger)]">{uzs(data.exposure.uzsAtMinus5pct)}</dd></div>
              </dl>
              <p className="text-[11px] text-muted-foreground mt-3">
                {t.fxExposureNote(uzs(data.exposure.uzsAtMinus5pct - data.exposure.uzsNow))}
              </p>
            </div>
          </div>

          <Link href="/admin/ledger" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            {t.perCarLedger} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
