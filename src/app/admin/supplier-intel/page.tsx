"use client";

import { useEffect, useState } from "react";
import { LineChart, Loader2, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface ModelRow {
  brand: string;
  model: string;
  orders: number;
  minCost: number;
  avgCost: number;
  maxCost: number;
  latestCost: number;
  trendPct: number;
  rising: boolean;
}
interface SupplierRow {
  supplier: string;
  orders: number;
  models: number;
  avgCost: number;
}
interface Data {
  byModel: ModelRow[];
  bySupplier: SupplierRow[];
  alerts: ModelRow[];
  totalOrders: number;
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

const COPY: Record<Locale, {
  title: string; intro: string; noData: string; noOrders: string;
  costsRising: string; latest: string; vsAvg: string; costHistoryByModel: string;
  bySupplier: string; model: string; pos: string; min: string; avg: string;
  max: string; latestCol: string; trend: string; supplier: string; models: string;
  avgUnitCost: string;
}> = {
  ru: {
    title: "Аналитика поставщиков",
    intro: "Динамика затрат по вашим заказам на закупку — выявляйте рост цен и самые выгодные источники. Накапливается по мере учёта закупок.",
    noData: "Нет данных по поставщикам.",
    noOrders: "Пока нет заказов на закупку с указанной себестоимостью — добавьте их в разделе «Закупки».",
    costsRising: "Затраты растут",
    latest: "последняя",
    vsAvg: "против средней",
    costHistoryByModel: "История затрат по моделям",
    bySupplier: "По поставщикам",
    model: "Модель",
    pos: "Заказы",
    min: "Мин",
    avg: "Сред",
    max: "Макс",
    latestCol: "Последняя",
    trend: "Динамика",
    supplier: "Поставщик",
    models: "Модели",
    avgUnitCost: "Сред. себестоимость",
  },
  uz: {
    title: "Yetkazib beruvchilar tahlili",
    intro: "Xarid buyurtmalaringiz bo'yicha xarajatlar dinamikasi — narx o'sishini va eng arzon manbalarni aniqlang. Xaridlarni hisobga olgan sari to'planadi.",
    noData: "Yetkazib beruvchilar bo'yicha ma'lumot yo'q.",
    noOrders: "Hozircha tannarxi ko'rsatilgan xarid buyurtmalari yo'q — ularni «Xaridlar» bo'limida qo'shing.",
    costsRising: "Xarajatlar oshmoqda",
    latest: "oxirgi",
    vsAvg: "o'rtachaga nisbatan",
    costHistoryByModel: "Modellar bo'yicha xarajatlar tarixi",
    bySupplier: "Yetkazib beruvchilar bo'yicha",
    model: "Model",
    pos: "Buyurtmalar",
    min: "Min",
    avg: "O'rtacha",
    max: "Maks",
    latestCol: "Oxirgi",
    trend: "Dinamika",
    supplier: "Yetkazib beruvchi",
    models: "Modellar",
    avgUnitCost: "O'rt. tannarx",
  },
  en: {
    title: "Supplier intelligence",
    intro: "Cost trends from your purchase orders — spot rising prices and your cheapest sources. Builds as you log more procurement.",
    noData: "No supplier data.",
    noOrders: "No purchase orders with a unit cost yet — add some in Procurement.",
    costsRising: "Costs rising",
    latest: "latest",
    vsAvg: "vs avg",
    costHistoryByModel: "Cost history by model",
    bySupplier: "By supplier",
    model: "Model",
    pos: "POs",
    min: "Min",
    avg: "Avg",
    max: "Max",
    latestCol: "Latest",
    trend: "Trend",
    supplier: "Supplier",
    models: "Models",
    avgUnitCost: "Avg unit cost",
  },
};

export default function AdminSupplierIntelPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats/supplier-intel")
      .then((r) => r.json())
      .then((d) => setData(d && d.ok ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <LineChart className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {t.intro}
      </p>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">{t.noData}</p>
      ) : data.totalOrders === 0 ? (
        <p className="text-sm text-muted-foreground">{t.noOrders}</p>
      ) : (
        <div className="space-y-8">
          {/* Rising-cost alerts */}
          {data.alerts.length > 0 && (
            <div className="bg-[rgba(192,106,92,0.10)] border border-[var(--danger)] p-4">
              <p className="text-sm font-medium text-[var(--danger)] flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4" /> {t.costsRising}
              </p>
              <ul className="space-y-1 text-sm text-foreground">
                {data.alerts.map((m) => (
                  <li key={`${m.brand}-${m.model}`} className="font-mono">
                    {m.brand} {m.model}: {t.latest} {usd(m.latestCost)} {t.vsAvg} {usd(m.avgCost)} (+{m.trendPct}%)
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Per-model cost history */}
          <div className="bg-card border border-border overflow-x-auto">
            <div className="px-4 py-3 border-b border-border"><h2 className="font-semibold text-foreground">{t.costHistoryByModel}</h2></div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-4 py-2 font-medium">{t.model}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.pos}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.min}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.avg}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.max}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.latestCol}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.trend}</th>
                </tr>
              </thead>
              <tbody>
                {data.byModel.map((m) => (
                  <tr key={`${m.brand}-${m.model}`} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-foreground">{m.brand} {m.model}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{m.orders}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{usd(m.minCost)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-foreground">{usd(m.avgCost)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{usd(m.maxCost)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-foreground">{usd(m.latestCost)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${m.trendPct > 0 ? "text-[var(--danger)]" : m.trendPct < 0 ? "text-[var(--success)]" : "text-muted-foreground"}`}>
                      <span className="inline-flex items-center gap-1 justify-end">
                        {m.trendPct > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : m.trendPct < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                        {m.trendPct > 0 ? "+" : ""}{m.trendPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Per-supplier */}
          <div className="bg-card border border-border overflow-x-auto">
            <div className="px-4 py-3 border-b border-border"><h2 className="font-semibold text-foreground">{t.bySupplier}</h2></div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-4 py-2 font-medium">{t.supplier}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.pos}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.models}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.avgUnitCost}</th>
                </tr>
              </thead>
              <tbody>
                {data.bySupplier.map((s) => (
                  <tr key={s.supplier} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-foreground">{s.supplier}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{s.orders}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{s.models}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-foreground">{usd(s.avgCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
