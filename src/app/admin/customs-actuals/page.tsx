"use client";

import { useEffect, useState } from "react";
import { Scale, Loader2, Plus } from "lucide-react";

interface Row {
  id: string; label: string | null; category: string; kind: string; age: string; origin: string;
  engine_cc: number | null; price_usd: number; predicted_customs_usd: number; actual_customs_usd: number;
  cleared_at: string | null; deltaPct: number | null; created_at: string;
}
interface Stats { count: number; meanErrPct: number; correctionFactor: number; within10Pct: number; accuracyPct: number }

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const CATS = ["car", "moto", "engine", "truck", "bus", "fura"];
const KINDS = ["electric", "petrol", "diesel", "hybrid", "phev"];
const AGES = ["new", "used1to3", "used3plus"];
const ORIGINS = ["fta", "certified", "uncertified"];

export default function CustomsActualsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [f, setF] = useState({ label: "", category: "car", kind: "petrol", age: "new", origin: "certified", engine_cc: "2000", price_usd: "", actual_customs_usd: "", cleared_at: "" });

  const load = () => {
    fetch("/api/admin/customs-actuals").then((r) => r.json()).then((d) => { if (d.ok) { setRows(d.rows || []); setStats(d.stats || null); } }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      const r = await fetch("/api/admin/customs-actuals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: f.label || undefined, category: f.category, kind: f.kind, age: f.age, origin: f.origin,
          engine_cc: Number(f.engine_cc) || 0, price_usd: Number(f.price_usd), actual_customs_usd: Number(f.actual_customs_usd),
          cleared_at: f.cleared_at || undefined,
        }),
      });
      const d = await r.json();
      if (r.ok) { setMsg(`✓ Прогноз $${d.predicted} · факт $${d.actual} · Δ ${d.deltaPct}%`); setF({ ...f, label: "", price_usd: "", actual_customs_usd: "" }); load(); }
      else setMsg("Ошибка: проверьте поля");
    } catch { setMsg("Не удалось сохранить"); }
    finally { setSaving(false); }
  };

  const sel = (val: string, set: (v: string) => void, opts: string[]) => (
    <select value={val} onChange={(e) => set(e.target.value)} className="h-10 rounded border border-border bg-background text-foreground px-2 text-sm">
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-1"><Scale className="w-6 h-6 text-primary" /><h1 className="text-2xl font-semibold text-foreground">Калибровка растаможки</h1></div>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">Логируйте реально растаможенные авто. Система сравнивает прогноз (customs-uz) с фактом и калибрует модель по вашим данным.</p>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-card border border-border rounded p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Записей</div><div className="text-2xl font-mono text-foreground">{stats.count}</div></div>
          <div className="bg-card border border-border rounded p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Точность ±10%</div><div className={`text-2xl font-mono ${stats.accuracyPct >= 80 ? "text-[var(--success,#16a34a)]" : "text-[var(--warning,#d97706)]"}`}>{stats.accuracyPct}%</div></div>
          <div className="bg-card border border-border rounded p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Ср. отклонение</div><div className={`text-2xl font-mono ${Math.abs(stats.meanErrPct) <= 5 ? "text-foreground" : "text-[var(--warning,#d97706)]"}`}>{stats.meanErrPct > 0 ? "+" : ""}{stats.meanErrPct}%</div></div>
          <div className="bg-card border border-border rounded p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Коэф. коррекции</div><div className="text-2xl font-mono text-foreground">×{stats.correctionFactor}</div></div>
        </div>
      )}
      {stats && Math.abs(stats.meanErrPct) > 5 && (
        <p className="text-xs text-[var(--warning,#d97706)] mb-4">⚠️ Модель в среднем {stats.meanErrPct > 0 ? "занижает" : "завышает"} растаможку на {Math.abs(stats.meanErrPct)}%. Рассмотрите коррекцию ставок в customs-uz (×{stats.correctionFactor}).</p>
      )}

      {/* Log form */}
      <form onSubmit={submit} className="bg-card border border-border rounded p-4 mb-6 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Добавить растаможенное авто</h2>
        <input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="BYD Han 2024" className="w-full h-10 rounded border border-border bg-background text-foreground px-3 text-sm" />
        <div className="flex flex-wrap gap-2">
          {sel(f.category, (v) => setF({ ...f, category: v }), CATS)}
          {sel(f.kind, (v) => setF({ ...f, kind: v }), KINDS)}
          {sel(f.age, (v) => setF({ ...f, age: v }), AGES)}
          {sel(f.origin, (v) => setF({ ...f, origin: v }), ORIGINS)}
          <input type="number" value={f.engine_cc} onChange={(e) => setF({ ...f, engine_cc: e.target.value })} placeholder="см³" className="h-10 w-24 rounded border border-border bg-background text-foreground px-2 text-sm" />
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="number" required value={f.price_usd} onChange={(e) => setF({ ...f, price_usd: e.target.value })} placeholder="Стоимость авto $" className="h-10 flex-1 min-w-32 rounded border border-border bg-background text-foreground px-3 text-sm" />
          <input type="number" required value={f.actual_customs_usd} onChange={(e) => setF({ ...f, actual_customs_usd: e.target.value })} placeholder="Факт. растаможка $" className="h-10 flex-1 min-w-32 rounded border border-border bg-background text-foreground px-3 text-sm" />
          <input type="date" value={f.cleared_at} onChange={(e) => setF({ ...f, cleared_at: e.target.value })} className="h-10 rounded border border-border bg-background text-foreground px-2 text-sm" />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 text-sm bg-primary text-primary-foreground rounded px-4 py-2 font-medium disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Добавить
          </button>
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
      </form>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Пока нет записей. Добавьте первое растаможенное авто выше.</p>
      ) : (
        <div className="bg-card border border-border rounded overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="px-4 py-2 font-medium">Авто</th><th className="px-4 py-2 font-medium text-right">Прогноз</th><th className="px-4 py-2 font-medium text-right">Факт</th><th className="px-4 py-2 font-medium text-right">Δ</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-foreground">{r.label || `${r.category} ${r.kind}`}<span className="text-[10px] text-muted-foreground block">{r.age} · {r.origin}{r.engine_cc ? ` · ${r.engine_cc}cc` : ""}</span></td>
                  <td className="px-4 py-2 text-right font-mono text-muted-foreground">{usd(r.predicted_customs_usd)}</td>
                  <td className="px-4 py-2 text-right font-mono text-foreground">{usd(r.actual_customs_usd)}</td>
                  <td className={`px-4 py-2 text-right font-mono ${r.deltaPct == null ? "text-muted-foreground" : Math.abs(r.deltaPct) <= 10 ? "text-[var(--success,#16a34a)]" : "text-[var(--danger,#ef4444)]"}`}>{r.deltaPct == null ? "—" : `${r.deltaPct > 0 ? "+" : ""}${r.deltaPct}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
