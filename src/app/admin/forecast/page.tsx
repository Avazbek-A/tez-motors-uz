"use client";

import { useEffect, useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";

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
  const [data, setData] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats/forecast").then((r) => r.json()).then((d) => d?.ok && setData(d)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Загрузка…</div>;
  if (!data) return <div className="p-6 text-muted-foreground">Нет данных.</div>;

  const r = data.runway;

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-[var(--accent)]" /><h1 className="text-lg font-semibold">Финансовый прогноз</h1></div>

      {/* Runway + cash */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { l: "Кэш сейчас", v: usd(r.cashNowUsd) },
          { l: "Приток / мес", v: usd(r.monthlyInflowUsd), tone: "text-[var(--success)]" },
          { l: "Отток / мес", v: usd(r.monthlyOutflowUsd), tone: "text-[var(--warning)]" },
          { l: "Запас хода", v: r.runwayMonths == null ? "∞ (в плюсе)" : `${r.runwayMonths} мес`, tone: r.runwayMonths != null && r.runwayMonths < 3 ? "text-[var(--danger,#e11)]" : "" },
        ].map((c) => (
          <div key={c.l} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="text-xs text-muted-foreground">{c.l}</div>
            <div className={`text-lg font-semibold ${c.tone || ""}`}>{c.v}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm">
        Депозиты как обязательство (получены, авто не выдан): <span className="font-semibold">{usd(data.depositsHeldUsd)}</span>
      </div>

      {/* Aging */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
        <h2 className="mb-2 text-sm font-semibold">Старение задолженности</h2>
        <table className="w-full text-xs">
          <thead><tr className="text-muted-foreground"><th className="text-left">Тип</th><th className="text-right">0–30</th><th className="text-right">30–60</th><th className="text-right">60–90</th><th className="text-right">90+</th><th className="text-right">Итого</th></tr></thead>
          <tbody>
            <AgingRow label="Дебиторка (счета)" a={data.arAging} />
            <AgingRow label="Кредиторка (закупки)" a={data.apAging} />
          </tbody>
        </table>
      </div>

      {/* FX exposure */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
        <h2 className="mb-2 text-sm font-semibold">Валютный риск (обязательства поставщикам в USD)</h2>
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
        <h2 className="mb-2 text-sm font-semibold">P&L по сделкам</h2>
        <table className="w-full text-xs">
          <thead><tr className="text-muted-foreground"><th className="text-left">Код</th><th className="text-left">Авто</th><th className="text-left">Статус</th><th className="text-right">Цена</th><th className="text-right">Себест.</th><th className="text-right">Депозит</th><th className="text-right">Маржа</th></tr></thead>
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
