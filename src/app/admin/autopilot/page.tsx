"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

const COPY: Record<Locale, {
  title: string;
  intro: string;
  noData: string;
  healthy: string;
  stale: string;
  noRunsYet: string;
  colJob: string;
  colCadence: string;
  colLastRun: string;
  colLastResult: string;
  colStatus: string;
  justNow: string;
  minsAgo: (n: number) => string;
  hoursAgo: (n: number) => string;
  daysAgo: (n: number) => string;
}> = {
  ru: {
    title: "Автопилот",
    intro: "Пульс каждой автоматизации — последний запуск и свежесть. «Устарело» означает, что задача не отчиталась в ожидаемом окне (проверьте cron-воркер / CRON_SECRET).",
    noData: "Данных по автоматизации пока нет — запуски появятся здесь, как только сработают плановые задачи (требуется миграция 032).",
    healthy: "В норме",
    stale: "Устарело",
    noRunsYet: "Запусков ещё нет",
    colJob: "Задача",
    colCadence: "Периодичность",
    colLastRun: "Последний запуск",
    colLastResult: "Последний результат",
    colStatus: "Статус",
    justNow: "только что",
    minsAgo: (n) => `${n} мин назад`,
    hoursAgo: (n) => `${n} ч назад`,
    daysAgo: (n) => `${n} дн назад`,
  },
  uz: {
    title: "Avtopilot",
    intro: "Har bir avtomatlashtirishning yurak urishi — so'nggi ishga tushish va yangiligi. «Eskirgan» degani vazifa kutilgan oraliqda hisobot bermagan (cron-vorkerni / CRON_SECRET ni tekshiring).",
    noData: "Hozircha avtomatlashtirish ma'lumotlari yo'q — rejalashtirilgan vazifalar ishga tushgach, bu yerda paydo bo'ladi (032 migratsiya talab qilinadi).",
    healthy: "Normal",
    stale: "Eskirgan",
    noRunsYet: "Hali ishga tushmagan",
    colJob: "Vazifa",
    colCadence: "Davriylik",
    colLastRun: "So'nggi ishga tushish",
    colLastResult: "So'nggi natija",
    colStatus: "Holat",
    justNow: "hozirgina",
    minsAgo: (n) => `${n} daqiqa oldin`,
    hoursAgo: (n) => `${n} soat oldin`,
    daysAgo: (n) => `${n} kun oldin`,
  },
  en: {
    title: "Autopilot",
    intro: "The heartbeat of every automation — last run and freshness. “Stale” means a job hasn’t reported within its expected window (check the cron worker / CRON_SECRET).",
    noData: "No automation data yet — runs appear here once the scheduled jobs fire (requires migration 032).",
    healthy: "Healthy",
    stale: "Stale",
    noRunsYet: "No runs yet",
    colJob: "Job",
    colCadence: "Cadence",
    colLastRun: "Last run",
    colLastResult: "Last result",
    colStatus: "Status",
    justNow: "just now",
    minsAgo: (n) => `${n}m ago`,
    hoursAgo: (n) => `${n}h ago`,
    daysAgo: (n) => `${n}d ago`,
  },
};

interface Job {
  key: string;
  label: string;
  cadence: string;
  lastRunAt: string | null;
  detail: Record<string, unknown> | null;
  status: "ok" | "stale" | "unknown";
}

interface Data {
  summary: { total: number; ok: number; stale: number; unknown: number };
  jobs: Job[];
}

const DOT: Record<string, string> = {
  ok: "bg-[var(--success)]",
  stale: "bg-[var(--danger)]",
  unknown: "bg-[var(--fg-4)]",
};
function ago(iso: string | null, t: (typeof COPY)[Locale]): string {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t.justNow;
  if (mins < 60) return t.minsAgo(mins);
  const h = Math.floor(mins / 60);
  if (h < 24) return t.hoursAgo(h);
  return t.daysAgo(Math.floor(h / 24));
}

function summarizeDetail(detail: Record<string, unknown> | null): string {
  if (!detail) return "";
  return Object.entries(detail)
    .filter(([, v]) => typeof v === "number" || typeof v === "string" || typeof v === "boolean")
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}

export default function AdminAutopilotPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const STATUS_LABEL: Record<string, string> = { ok: t.healthy, stale: t.stale, unknown: t.noRunsYet };
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats/automation")
      .then((r) => r.json())
      .then((d) => setData(d && d.ok ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-1">
        <Activity className="w-6 h-6 text-primary" />
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
        <>
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: t.healthy, value: data.summary.ok, tone: "text-[var(--success)]" },
              { label: t.stale, value: data.summary.stale, tone: data.summary.stale > 0 ? "text-[var(--danger)]" : "text-foreground" },
              { label: t.noRunsYet, value: data.summary.unknown, tone: "text-muted-foreground" },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border p-4">
                <p className={`font-mono text-2xl font-semibold ${s.tone}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-4 py-2 font-medium">{t.colJob}</th>
                  <th className="px-4 py-2 font-medium">{t.colCadence}</th>
                  <th className="px-4 py-2 font-medium">{t.colLastRun}</th>
                  <th className="px-4 py-2 font-medium">{t.colLastResult}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {data.jobs.map((j) => (
                  <tr key={j.key} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-foreground">{j.label}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{j.cadence}</td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{ago(j.lastRunAt, t)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{summarizeDetail(j.detail) || "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center gap-2 justify-end">
                        <span className={`w-2 h-2 rounded-full ${DOT[j.status]}`} />
                        <span className="text-xs text-muted-foreground">{STATUS_LABEL[j.status]}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
