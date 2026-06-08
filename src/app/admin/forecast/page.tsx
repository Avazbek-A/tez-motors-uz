"use client";

import { useEffect, useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface Aging { d0_30: number; d30_60: number; d60_90: number; d90_plus: number; total: number; }
interface Deal { reference: string; car: string; status: string; listUsd: number; costUsd: number | null; depositUsd: number; marginUsd: number | null; realized: boolean; }
interface Forecast {
  ok: boolean;
  runway: { cashNowUsd: number; monthlyInflowUsd: number; monthlyOutflowUsd: number; netMonthlyUsd: number; runwayMonths: number | null };
  arAging: Aging; apAging: Aging; depositsHeldUsd: number;
  fxExposure: { pct: number; usdUzsAt: number; uzsValue: number }[];
  deals: Deal[];
}

const usd = (n: number | null) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));
const uzs = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " so'm";

const COPY: Record<Locale, {
  loading: string;
  noData: string;
  title: string;
  cashNow: string;
  inflowPerMonth: string;
  outflowPerMonth: string;
  runway: string;
  runwayInfinite: string;
  runwayMonths: (n: number) => string;
  depositsLiability: string;
  agingTitle: string;
  agingType: string;
  agingTotal: string;
  arLabel: string;
  apLabel: string;
  fxTitle: string;
  dealPnlTitle: string;
  colCode: string;
  colCar: string;
  colStatus: string;
  colPrice: string;
  colCost: string;
  colDeposit: string;
  colMargin: string;
  noDeals: string;
}> = {
  ru: {
    loading: "Загрузка…",
    noData: "Нет данных.",
    title: "Финансовый прогноз",
    cashNow: "Кэш сейчас",
    inflowPerMonth: "Приток / мес",
    outflowPerMonth: "Отток / мес",
    runway: "Запас хода",
    runwayInfinite: "∞ (в плюсе)",
    runwayMonths: (n) => `${n} мес`,
    depositsLiability: "Депозиты как обязательство (получены, авто не выдан):",
    agingTitle: "Старение задолженности",
    agingType: "Тип",
    agingTotal: "Итого",
    arLabel: "Дебиторка (счета)",
    apLabel: "Кредиторка (закупки)",
    fxTitle: "Валютный риск (обязательства поставщикам в USD)",
    dealPnlTitle: "P&L по сделкам",
    colCode: "Код",
    colCar: "Авто",
    colStatus: "Статус",
    colPrice: "Цена",
    colCost: "Себест.",
    colDeposit: "Депозит",
    colMargin: "Маржа",
    noDeals: "Сделок пока нет.",
  },
  uz: {
    loading: "Yuklanmoqda…",
    noData: "Ma'lumot yo'q.",
    title: "Moliyaviy prognoz",
    cashNow: "Hozirgi naqd",
    inflowPerMonth: "Kirim / oy",
    outflowPerMonth: "Chiqim / oy",
    runway: "Zaxira muddat",
    runwayInfinite: "∞ (plyusda)",
    runwayMonths: (n) => `${n} oy`,
    depositsLiability: "Depozitlar majburiyat sifatida (olingan, avtomobil topshirilmagan):",
    agingTitle: "Qarzdorlik eskirishi",
    agingType: "Turi",
    agingTotal: "Jami",
    arLabel: "Debitorlik (hisob-fakturalar)",
    apLabel: "Kreditorlik (xaridlar)",
    fxTitle: "Valyuta xavfi (ta'minotchilarga USD majburiyatlar)",
    dealPnlTitle: "Bitimlar bo'yicha P&L",
    colCode: "Kod",
    colCar: "Avto",
    colStatus: "Holat",
    colPrice: "Narx",
    colCost: "Tannarx",
    colDeposit: "Depozit",
    colMargin: "Marja",
    noDeals: "Hozircha bitimlar yo'q.",
  },
  en: {
    loading: "Loading…",
    noData: "No data.",
    title: "Financial forecast",
    cashNow: "Cash now",
    inflowPerMonth: "Inflow / mo",
    outflowPerMonth: "Outflow / mo",
    runway: "Runway",
    runwayInfinite: "∞ (positive)",
    runwayMonths: (n) => `${n} mo`,
    depositsLiability: "Deposits as a liability (collected, car not delivered):",
    agingTitle: "Receivables/payables aging",
    agingType: "Type",
    agingTotal: "Total",
    arLabel: "Receivables (invoices)",
    apLabel: "Payables (purchases)",
    fxTitle: "FX exposure (supplier liabilities in USD)",
    dealPnlTitle: "Deal P&L",
    colCode: "Code",
    colCar: "Car",
    colStatus: "Status",
    colPrice: "Price",
    colCost: "Cost",
    colDeposit: "Deposit",
    colMargin: "Margin",
    noDeals: "No deals yet.",
  },
};

function AgingRow({ label, a }: { label: string; a: Aging }) {
  return (
    <tr className="border-t border-[var(--border)]">
      <td className="py-1 pr-3 font-medium">{label}</td>
      <td className="py-1 px-2 text-right">{usd(a.d0_30)}</td>
      <td className="py-1 px-2 text-right">{usd(a.d30_60)}</td>
      <td className="py-1 px-2 text-right">{usd(a.d60_90)}</td>
      <td className="py-1 px-2 text-right text-[var(--warning)]">{usd(a.d90_plus)}</td>
      <td className="py-1 pl-2 text-right font-semibold">{usd(a.total)}</td>
    </tr>
  );
}

export default function AdminForecastPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [data, setData] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats/forecast").then((r) => r.json()).then((d) => d?.ok && setData(d)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {t.loading}</div>;
  if (!data) return <div className="p-6 text-muted-foreground">{t.noData}</div>;

  const r = data.runway;

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-[var(--accent)]" /><h1 className="text-lg font-semibold">{t.title}</h1></div>

      {/* Runway + cash */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { l: t.cashNow, v: usd(r.cashNowUsd) },
          { l: t.inflowPerMonth, v: usd(r.monthlyInflowUsd), tone: "text-[var(--success)]" },
          { l: t.outflowPerMonth, v: usd(r.monthlyOutflowUsd), tone: "text-[var(--warning)]" },
          { l: t.runway, v: r.runwayMonths == null ? t.runwayInfinite : t.runwayMonths(r.runwayMonths), tone: r.runwayMonths != null && r.runwayMonths < 3 ? "text-[var(--danger,#e11)]" : "" },
        ].map((c) => (
          <div key={c.l} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="text-xs text-muted-foreground">{c.l}</div>
            <div className={`text-lg font-semibold ${c.tone || ""}`}>{c.v}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm">
        {t.depositsLiability} <span className="font-semibold">{usd(data.depositsHeldUsd)}</span>
      </div>

      {/* Aging */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
        <h2 className="mb-2 text-sm font-semibold">{t.agingTitle}</h2>
        <table className="w-full text-xs">
          <thead><tr className="text-muted-foreground"><th className="text-left">{t.agingType}</th><th className="text-right">0–30</th><th className="text-right">30–60</th><th className="text-right">60–90</th><th className="text-right">90+</th><th className="text-right">{t.agingTotal}</th></tr></thead>
          <tbody>
            <AgingRow label={t.arLabel} a={data.arAging} />
            <AgingRow label={t.apLabel} a={data.apAging} />
          </tbody>
        </table>
      </div>

      {/* FX exposure */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
        <h2 className="mb-2 text-sm font-semibold">{t.fxTitle}</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {data.fxExposure.map((s) => (
            <div key={s.pct} className={`rounded border px-2 py-1 ${s.pct === 0 ? "border-[var(--accent)]" : "border-[var(--border)]"}`}>
              <div className="text-muted-foreground">{s.pct > 0 ? `+${s.pct}` : s.pct}% (₸{s.usdUzsAt})</div>
              <div className="font-medium">{uzs(s.uzsValue)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Deal P&L */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
        <h2 className="mb-2 text-sm font-semibold">{t.dealPnlTitle}</h2>
        <table className="w-full text-xs">
          <thead><tr className="text-muted-foreground"><th className="text-left">{t.colCode}</th><th className="text-left">{t.colCar}</th><th className="text-left">{t.colStatus}</th><th className="text-right">{t.colPrice}</th><th className="text-right">{t.colCost}</th><th className="text-right">{t.colDeposit}</th><th className="text-right">{t.colMargin}</th></tr></thead>
          <tbody>
            {data.deals.map((d) => (
              <tr key={d.reference} className="border-t border-[var(--border)]">
                <td className="py-1 pr-2 font-mono">{d.reference}</td>
                <td className="py-1 pr-2">{d.car}</td>
                <td className="py-1 pr-2">{d.status}{d.realized ? " ✓" : ""}</td>
                <td className="py-1 px-1 text-right">{usd(d.listUsd)}</td>
                <td className="py-1 px-1 text-right">{usd(d.costUsd)}</td>
                <td className="py-1 px-1 text-right">{usd(d.depositUsd)}</td>
                <td className={`py-1 pl-1 text-right font-semibold ${d.marginUsd != null && d.marginUsd < 0 ? "text-[var(--danger,#e11)]" : "text-[var(--success)]"}`}>{usd(d.marginUsd)}</td>
              </tr>
            ))}
            {!data.deals.length && <tr><td colSpan={7} className="py-2 text-center text-muted-foreground">Сделок пока нет.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
