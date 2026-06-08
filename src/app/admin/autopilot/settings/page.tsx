"use client";

import { useEffect, useState } from "react";
import { Loader2, Bot, Save } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface Config {
  master: boolean;
  autoMarkdown: { enabled: boolean; minDaysOnLot: number; maxPerRun: number; minMarginPct: number };
  autoSourceDrafts: { enabled: boolean; maxPerRun: number; minDemandScore: number };
}

const COPY: Record<Locale, {
  saved: string;
  saveError: string;
  connectionError: string;
  loading: string;
  heading: string;
  intro: string;
  masterSwitch: string;
  masterHint: string;
  autoMarkdownLabel: string;
  olderThanDays: string;
  maxCarsPerRun: string;
  minMarginPct: string;
  demandToDrafts: string;
  maxDraftsPerRun: string;
  minDemand: string;
  save: string;
}> = {
  ru: {
    saved: "Сохранено ✓",
    saveError: "Ошибка сохранения",
    connectionError: "Ошибка связи",
    loading: "Загрузка…",
    heading: "Автопилот — автономные действия",
    intro: "Система выполняет действия автоматически. Только обратимые: уценка в рамках маржи и ЧЕРНОВИКИ заявок (никогда не заказывает и не двигает деньги). Каждое действие аудируется, дилер уведомляется.",
    masterSwitch: "Главный выключатель",
    masterHint: "(выкл = ничего автономного не выполняется)",
    autoMarkdownLabel: "Авто-уценка залежавшегося",
    olderThanDays: "Старше дней на складе",
    maxCarsPerRun: "Макс. машин за запуск",
    minMarginPct: "Мин. маржа % (не ниже себест.)",
    demandToDrafts: "Спрос → черновики заявок поставщику",
    maxDraftsPerRun: "Макс. черновиков за запуск",
    minDemand: "Мин. спрос (заявок/30д)",
    save: "Сохранить",
  },
  uz: {
    saved: "Saqlandi ✓",
    saveError: "Saqlashda xato",
    connectionError: "Aloqa xatosi",
    loading: "Yuklanmoqda…",
    heading: "Avtopilot — avtonom amallar",
    intro: "Tizim amallarni avtomatik bajaradi. Faqat qaytariladiganlar: marja doirasida narx tushirish va so'rov QORALAMALARI (hech qachon buyurtma bermaydi va pul harakatlantirmaydi). Har bir amal auditdan o'tadi, diler xabardor qilinadi.",
    masterSwitch: "Asosiy o'chirgich",
    masterHint: "(o'chiq = hech qanday avtonom amal bajarilmaydi)",
    autoMarkdownLabel: "Qolib ketganni avto-narxlash",
    olderThanDays: "Omborda shuncha kundan ortiq",
    maxCarsPerRun: "Bir ishga tushishda maks. mashina",
    minMarginPct: "Min. marja % (tannarxdan past emas)",
    demandToDrafts: "Talab → yetkazib beruvchiga so'rov qoralamalari",
    maxDraftsPerRun: "Bir ishga tushishda maks. qoralama",
    minDemand: "Min. talab (so'rov/30 kun)",
    save: "Saqlash",
  },
  en: {
    saved: "Saved ✓",
    saveError: "Save error",
    connectionError: "Connection error",
    loading: "Loading…",
    heading: "Autopilot — autonomous actions",
    intro: "The system performs actions automatically. Reversible only: markdowns within margin and inquiry DRAFTS (it never orders or moves money). Every action is audited and the dealer is notified.",
    masterSwitch: "Master switch",
    masterHint: "(off = nothing autonomous runs)",
    autoMarkdownLabel: "Auto-markdown of aged stock",
    olderThanDays: "Older than days on lot",
    maxCarsPerRun: "Max cars per run",
    minMarginPct: "Min margin % (not below cost)",
    demandToDrafts: "Demand → supplier inquiry drafts",
    maxDraftsPerRun: "Max drafts per run",
    minDemand: "Min demand (inquiries/30d)",
    save: "Save",
  },
};

export default function AutopilotSettingsPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
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
      if (d?.ok) { setCfg(d.config); setMsg(t.saved); } else setMsg(t.saveError);
    } catch { setMsg(t.connectionError); } finally { setSaving(false); }
  }

  if (!cfg) return <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {t.loading}</div>;

  const num = (path: (c: Config) => number, set: (c: Config, v: number) => void, label: string) => (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input type="number" value={path(cfg)} onChange={(e) => { const v = Number(e.target.value); setCfg((c) => { const n = structuredClone(c!); set(n, v); return n; }); }} className="w-20 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-right" />
    </label>
  );

  return (
    <div className="mx-auto max-w-xl space-y-5 p-1">
      <div className="flex items-center gap-2"><Bot className="h-5 w-5 text-[var(--accent)]" /><h1 className="text-lg font-semibold">{t.heading}</h1></div>
      <p className="text-xs text-muted-foreground">{t.intro}</p>

      <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
        <input type="checkbox" checked={cfg.master} onChange={(e) => setCfg({ ...cfg, master: e.target.checked })} />
        <span className="font-medium">{t.masterSwitch}</span>
        <span className="text-xs text-muted-foreground">{t.masterHint}</span>
      </label>

      <div className={`space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 ${cfg.master ? "" : "opacity-50"}`}>
        <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={cfg.autoMarkdown.enabled} onChange={(e) => setCfg({ ...cfg, autoMarkdown: { ...cfg.autoMarkdown, enabled: e.target.checked } })} /> {t.autoMarkdownLabel}</label>
        {num((c) => c.autoMarkdown.minDaysOnLot, (c, v) => (c.autoMarkdown.minDaysOnLot = v), t.olderThanDays)}
        {num((c) => c.autoMarkdown.maxPerRun, (c, v) => (c.autoMarkdown.maxPerRun = v), t.maxCarsPerRun)}
        {num((c) => c.autoMarkdown.minMarginPct, (c, v) => (c.autoMarkdown.minMarginPct = v), t.minMarginPct)}
      </div>

      <div className={`space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 ${cfg.master ? "" : "opacity-50"}`}>
        <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={cfg.autoSourceDrafts.enabled} onChange={(e) => setCfg({ ...cfg, autoSourceDrafts: { ...cfg.autoSourceDrafts, enabled: e.target.checked } })} /> {t.demandToDrafts}</label>
        {num((c) => c.autoSourceDrafts.maxPerRun, (c, v) => (c.autoSourceDrafts.maxPerRun = v), t.maxDraftsPerRun)}
        {num((c) => c.autoSourceDrafts.minDemandScore, (c, v) => (c.autoSourceDrafts.minDemandScore = v), t.minDemand)}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t.save}</button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}
