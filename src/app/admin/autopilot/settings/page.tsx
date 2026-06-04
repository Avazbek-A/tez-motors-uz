"use client";

import { useEffect, useState } from "react";
import { Loader2, Bot, Save } from "lucide-react";

interface Config {
  master: boolean;
  autoMarkdown: { enabled: boolean; minDaysOnLot: number; maxPerRun: number; minMarginPct: number };
  autoSourceDrafts: { enabled: boolean; maxPerRun: number; minDemandScore: number };
}

export default function AutopilotSettingsPage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/autopilot-config").then((r) => r.json()).then((d) => d?.ok && setCfg(d.config));
  }, []);

  async function save() {
    if (!cfg) return;
    setSaving(true); setMsg("");
    try {
      const res = await fetch("/api/admin/autopilot-config", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(cfg) });
      const d = await res.json();
      if (d?.ok) { setCfg(d.config); setMsg("Сохранено ✓"); } else setMsg("Ошибка сохранения");
    } catch { setMsg("Ошибка связи"); } finally { setSaving(false); }
  }

  if (!cfg) return <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Загрузка…</div>;

  const num = (path: (c: Config) => number, set: (c: Config, v: number) => void, label: string) => (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input type="number" value={path(cfg)} onChange={(e) => { const v = Number(e.target.value); setCfg((c) => { const n = structuredClone(c!); set(n, v); return n; }); }} className="w-20 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-right" />
    </label>
  );

  return (
    <div className="mx-auto max-w-xl space-y-5 p-1">
      <div className="flex items-center gap-2"><Bot className="h-5 w-5 text-[var(--accent)]" /><h1 className="text-lg font-semibold">Автопилот — автономные действия</h1></div>
      <p className="text-xs text-muted-foreground">Система выполняет действия автоматически. Только обратимые: уценка в рамках маржи и ЧЕРНОВИКИ заявок (никогда не заказывает и не двигает деньги). Каждое действие аудируется, дилер уведомляется.</p>

      <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
        <input type="checkbox" checked={cfg.master} onChange={(e) => setCfg({ ...cfg, master: e.target.checked })} />
        <span className="font-medium">Главный выключатель</span>
        <span className="text-xs text-muted-foreground">(выкл = ничего автономного не выполняется)</span>
      </label>

      <div className={`space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 ${cfg.master ? "" : "opacity-50"}`}>
        <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={cfg.autoMarkdown.enabled} onChange={(e) => setCfg({ ...cfg, autoMarkdown: { ...cfg.autoMarkdown, enabled: e.target.checked } })} /> Авто-уценка залежавшегося</label>
        {num((c) => c.autoMarkdown.minDaysOnLot, (c, v) => (c.autoMarkdown.minDaysOnLot = v), "Старше дней на складе")}
        {num((c) => c.autoMarkdown.maxPerRun, (c, v) => (c.autoMarkdown.maxPerRun = v), "Макс. машин за запуск")}
        {num((c) => c.autoMarkdown.minMarginPct, (c, v) => (c.autoMarkdown.minMarginPct = v), "Мин. маржа % (не ниже себест.)")}
      </div>

      <div className={`space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 ${cfg.master ? "" : "opacity-50"}`}>
        <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={cfg.autoSourceDrafts.enabled} onChange={(e) => setCfg({ ...cfg, autoSourceDrafts: { ...cfg.autoSourceDrafts, enabled: e.target.checked } })} /> Спрос → черновики заявок поставщику</label>
        {num((c) => c.autoSourceDrafts.maxPerRun, (c, v) => (c.autoSourceDrafts.maxPerRun = v), "Макс. черновиков за запуск")}
        {num((c) => c.autoSourceDrafts.minDemandScore, (c, v) => (c.autoSourceDrafts.minDemandScore = v), "Мин. спрос (заявок/30д)")}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Сохранить</button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}
