"use client";

import { useEffect, useState } from "react";
import { Cpu, Loader2, Zap, ArrowRight, Lightbulb } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface TierStat {
  tier: string;
  calls24: number;
  switched24: number;
  failed24: number;
  calls7: number;
  switched7: number;
  failed7: number;
  avgLatencyMs: number | null;
}
interface ModelStat {
  provider: string;
  model: string;
  answered: number;
  non_ok: number;
  empty: number;
  timeout: number;
  error: number;
  lastUsed: string | null;
}
interface ChainEntry { provider: string; model: string }
interface Pick { tier: string; chain: ChainEntry[] }
interface RecentRow {
  tier: string;
  provider: string | null;
  answered_model: string | null;
  attempts: number;
  failures: { model: string; provider?: string; reason: string; status?: number }[];
  created_at: string;
}
interface Suggestion { tier: string; current?: string; suggest: string; reason?: string }
interface Catalog {
  scanned_at?: string;
  free_count?: number;
  suggestions?: Suggestion[];
  top?: Record<string, string[]>;
}
interface Health {
  ok: boolean;
  hasLog: boolean;
  generatedAt?: string;
  picks: Pick[];
  catalog: Catalog | null;
  tierStats: TierStat[];
  models: ModelStat[];
  totals: { calls24: number; switched24: number; failed24: number; calls7: number } | null;
  recent: RecentRow[];
}

const COPY: Record<Locale, Record<string, string>> = {
  ru: {
    title: "AI-модели",
    intro: "Здоровье бесплатных моделей. Ассистент работает на бесплатных моделях OpenRouter, которые иногда недоступны (404/429) — тогда вызов переключается на следующую модель в цепочке. Здесь видно, как часто это происходит и какая модель сейчас тянет нагрузку.",
    calls24: "Вызовов (24ч)",
    switches24: "Переключений (24ч)",
    fallbacks24: "Откатов к шаблону (24ч)",
    switchRate: "доля переключений",
    test: "Проверить подключение",
    chains: "Текущие модели по задачам (порядок резерва)",
    tierChat: "Чат (ассистент)",
    tierReason: "Анализ (парсинг/контент/оператор)",
    tierVision: "Зрение (скриншоты)",
    perTier: "По задачам",
    thTier: "Задача",
    thCalls: "Вызовы 24ч",
    thSwitch: "Переключения",
    thFail: "Откаты",
    thLatency: "Ср. задержка",
    perModel: "По моделям (7 дней)",
    thProvider: "Провайдер",
    thModel: "Модель",
    thAnswered: "Ответов",
    thFailures: "Сбоев (4xx/пусто/таймаут/ошибка)",
    thLast: "Последний",
    suggestions: "💡 Рекомендации: новые бесплатные модели",
    sugIntro: "Еженедельное сканирование каталога OpenRouter. Применить можно в Настройка → ИИ (или попросить меня).",
    noSug: "Новых рекомендаций нет — текущие модели актуальны.",
    suggest: "предложение",
    current: "сейчас",
    scanned: "сканировано",
    free: "бесплатных моделей",
    recent: "Недавние переключения / сбои",
    noRecent: "Переключений не было — всё на основной модели ✓",
    noLog: "Нет данных телеметрии (нужна миграция 083 или ещё не было вызовов).",
    loading: "Загрузка…",
    answeredBy: "ответила",
    template: "шаблон (все модели не ответили)",
    none: "—",
  },
  uz: {
    title: "AI-modellar",
    intro: "Bepul modellar holati. Assistent OpenRouter bepul modellarida ishlaydi, ular ba'zan ishlamaydi (404/429) — shunda chaqiruv zanjirdagi keyingi modelga o'tadi. Bu yerda bu qanchalik tez-tez sodir bo'lishi va hozir qaysi model yuklamani ko'tarayotgani ko'rinadi.",
    calls24: "Chaqiruvlar (24s)",
    switches24: "Almashuvlar (24s)",
    fallbacks24: "Shablonga qaytish (24s)",
    switchRate: "almashuv ulushi",
    test: "Ulanishni tekshirish",
    chains: "Vazifalar bo'yicha joriy modellar (zaxira tartibi)",
    tierChat: "Chat (assistent)",
    tierReason: "Tahlil (parsing/kontent/operator)",
    tierVision: "Ko'rish (skrinshotlar)",
    perTier: "Vazifalar bo'yicha",
    thTier: "Vazifa",
    thCalls: "Chaqiruv 24s",
    thSwitch: "Almashuvlar",
    thFail: "Qaytishlar",
    thLatency: "O'rt. kechikish",
    perModel: "Modellar bo'yicha (7 kun)",
    thProvider: "Provayder",
    thModel: "Model",
    thAnswered: "Javoblar",
    thFailures: "Xatolar (4xx/bo'sh/taymaut/xato)",
    thLast: "Oxirgi",
    suggestions: "💡 Tavsiyalar: yangi bepul modellar",
    sugIntro: "OpenRouter katalogini haftalik skanerlash. Sozlash → AI bo'limida qo'llash mumkin (yoki mendan so'rang).",
    noSug: "Yangi tavsiyalar yo'q — joriy modellar dolzarb.",
    suggest: "taklif",
    current: "hozir",
    scanned: "skanerlandi",
    free: "bepul model",
    recent: "So'nggi almashuvlar / xatolar",
    noRecent: "Almashuvlar bo'lmadi — hammasi asosiy modelda ✓",
    noLog: "Telemetriya ma'lumotlari yo'q (083-migratsiya kerak yoki hali chaqiruv bo'lmagan).",
    loading: "Yuklanmoqda…",
    answeredBy: "javob berdi",
    template: "shablon (hech bir model javob bermadi)",
    none: "—",
  },
  en: {
    title: "AI Models",
    intro: "Free-model health. The assistant runs on OpenRouter free models, which are sometimes unavailable (404/429) — a call then switches to the next model in the chain. This shows how often that happens and which model is currently carrying the load.",
    calls24: "Calls (24h)",
    switches24: "Switches (24h)",
    fallbacks24: "Template fallbacks (24h)",
    switchRate: "switch rate",
    test: "Test connection",
    chains: "Current models per task (fallback order)",
    tierChat: "Chat (assistant)",
    tierReason: "Reason (parse/content/operator)",
    tierVision: "Vision (screenshots)",
    perTier: "By task",
    thTier: "Task",
    thCalls: "Calls 24h",
    thSwitch: "Switches",
    thFail: "Fallbacks",
    thLatency: "Avg latency",
    perModel: "By model (7 days)",
    thProvider: "Provider",
    thModel: "Model",
    thAnswered: "Answered",
    thFailures: "Failures (4xx/empty/timeout/error)",
    thLast: "Last used",
    suggestions: "💡 Suggestions: newer free models",
    sugIntro: "Weekly scan of the OpenRouter catalog. Apply in Setup → AI (or ask me to).",
    noSug: "No new suggestions — current models are up to date.",
    suggest: "suggest",
    current: "current",
    scanned: "scanned",
    free: "free models",
    recent: "Recent switches / failures",
    noRecent: "No switches — everything on the primary model ✓",
    noLog: "No telemetry yet (requires migration 083, or no calls made yet).",
    loading: "Loading…",
    answeredBy: "answered",
    template: "template (no model answered)",
    none: "—",
  },
};

const TIER_LABEL = (t: string, c: Record<string, string>) =>
  t === "chat" ? c.tierChat : t === "reason" ? c.tierReason : t === "vision" ? c.tierVision : t;

function ago(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function pct(n: number, d: number): string {
  if (!d) return "0%";
  return `${Math.round((n / d) * 100)}%`;
}

const short = (m: string | null) => (m ? m.replace(/^[^/]+\//, "").replace(/:free$/, "") : "—");

export default function AdminLlmPage() {
  const { locale } = useLocale();
  const c = COPY[locale];
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; provider?: string; model?: string; latencyMs?: number; sample?: string; message?: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/llm-health")
      .then((r) => r.json())
      .then((d) => setData(d && d.ok ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch("/api/admin/llm/test", { method: "POST" });
      setTestResult(await r.json());
    } catch {
      setTestResult({ ok: false, message: "request failed" });
    } finally {
      setTesting(false);
    }
  };

  const suggestions = data?.catalog?.suggestions || [];

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <Cpu className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">{c.title}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 max-w-3xl">{c.intro}</p>

      {/* Headline 24h cards */}
      {data?.totals && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-card border border-border rounded p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{c.calls24}</div>
            <div className="text-2xl font-mono text-foreground">{data.totals.calls24}</div>
          </div>
          <div className="bg-card border border-border rounded p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{c.switches24}</div>
            <div className="text-2xl font-mono text-foreground">
              {data.totals.switched24}
              <span className="text-sm text-muted-foreground ml-2">{pct(data.totals.switched24, data.totals.calls24)}</span>
            </div>
          </div>
          <div className="bg-card border border-border rounded p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{c.fallbacks24}</div>
            <div className={`text-2xl font-mono ${data.totals.failed24 > 0 ? "text-[var(--danger,#ef4444)]" : "text-[var(--success,#16a34a)]"}`}>
              {data.totals.failed24}
            </div>
          </div>
        </div>
      )}

      {/* Test connection */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <button
          onClick={runTest}
          disabled={testing}
          className="inline-flex items-center gap-1.5 text-sm border border-border bg-card hover:bg-muted/40 rounded px-3 py-1.5 text-foreground disabled:opacity-50"
        >
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} {c.test}
        </button>
        {testResult && (
          <span className={`text-xs font-mono ${testResult.ok ? "text-[var(--success,#16a34a)]" : "text-[var(--warning,#d97706)]"}`}>
            {testResult.ok
              ? `✓ ${testResult.provider} · ${short(testResult.model || "")} · ${testResult.latencyMs}ms — "${testResult.sample}"`
              : `✗ ${testResult.message || "no response"}`}
          </span>
        )}
      </div>

      {/* Suggestions — the "better free models available" digest */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <Lightbulb className="w-4 h-4 text-primary" /> {c.suggestions}
        </h2>
        <p className="text-xs text-muted-foreground mb-2">
          {c.sugIntro}
          {data?.catalog?.scanned_at && (
            <span className="ml-1">· {c.scanned} {ago(data.catalog.scanned_at)} · {data.catalog.free_count ?? "?"} {c.free}</span>
          )}
        </p>
        {suggestions.length === 0 ? (
          <p className="text-xs text-[var(--success,#16a34a)]">{c.noSug}</p>
        ) : (
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="bg-card border border-border rounded p-3 flex items-start gap-3 text-sm">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 rounded px-2 py-0.5 mt-0.5">{TIER_LABEL(s.tier, c)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 font-mono text-xs flex-wrap">
                    <span className="text-muted-foreground">{short(s.current || null)}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-foreground font-semibold">{short(s.suggest)}</span>
                  </div>
                  {s.reason && <div className="text-xs text-muted-foreground mt-1">{s.reason}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current chain per tier */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-2">{c.chains}</h2>
        <div className="space-y-2">
          {(data?.picks || []).map((p) => (
            <div key={p.tier} className="bg-card border border-border rounded p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">{TIER_LABEL(p.tier, c)}</div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {p.chain.length === 0 && <span className="text-xs text-muted-foreground">{c.none}</span>}
                {p.chain.map((m, i) => (
                  <span key={`${m.provider}/${m.model}`} className="inline-flex items-center gap-1.5">
                    {i > 0 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                    <span className={`font-mono text-xs rounded px-2 py-0.5 ${i === 0 ? "bg-primary/15 text-foreground" : "bg-muted/40 text-muted-foreground"}`}>
                      <span className="opacity-60">{m.provider}</span> {short(m.model)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">{c.noLog}</p>
      ) : !data.hasLog ? (
        <p className="text-sm text-muted-foreground">{c.noLog}</p>
      ) : (
        <>
          {/* Per-tier */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-foreground mb-2">{c.perTier}</h2>
            <div className="bg-card border border-border overflow-x-auto rounded">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="px-4 py-2 font-medium">{c.thTier}</th>
                    <th className="px-4 py-2 font-medium text-right">{c.thCalls}</th>
                    <th className="px-4 py-2 font-medium text-right">{c.thSwitch}</th>
                    <th className="px-4 py-2 font-medium text-right">{c.thFail}</th>
                    <th className="px-4 py-2 font-medium text-right">{c.thLatency}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tierStats.map((s) => (
                    <tr key={s.tier} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 text-foreground">{TIER_LABEL(s.tier, c)}</td>
                      <td className="px-4 py-2 text-right font-mono text-muted-foreground">{s.calls24}</td>
                      <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                        {s.switched24}<span className="text-[10px] ml-1">{pct(s.switched24, s.calls24)}</span>
                      </td>
                      <td className={`px-4 py-2 text-right font-mono ${s.failed24 > 0 ? "text-[var(--danger,#ef4444)]" : "text-muted-foreground"}`}>{s.failed24}</td>
                      <td className="px-4 py-2 text-right font-mono text-muted-foreground">{s.avgLatencyMs != null ? `${s.avgLatencyMs}ms` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-model */}
          {data.models.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-foreground mb-2">{c.perModel}</h2>
              <div className="bg-card border border-border overflow-x-auto rounded">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="px-4 py-2 font-medium">{c.thProvider}</th>
                      <th className="px-4 py-2 font-medium">{c.thModel}</th>
                      <th className="px-4 py-2 font-medium text-right">{c.thAnswered}</th>
                      <th className="px-4 py-2 font-medium text-right">{c.thFailures}</th>
                      <th className="px-4 py-2 font-medium text-right">{c.thLast}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.models.map((m) => {
                      const fails = m.non_ok + m.empty + m.timeout + m.error;
                      return (
                        <tr key={`${m.provider}/${m.model}`} className="border-b border-border last:border-0">
                          <td className="px-4 py-2 text-xs text-muted-foreground">{m.provider}</td>
                          <td className="px-4 py-2 font-mono text-xs text-foreground" title={m.model}>{short(m.model)}</td>
                          <td className="px-4 py-2 text-right font-mono text-[var(--success,#16a34a)]">{m.answered}</td>
                          <td className={`px-4 py-2 text-right font-mono ${fails > 0 ? "text-[var(--warning,#d97706)]" : "text-muted-foreground"}`}>
                            {fails > 0 ? `${fails} (${[m.non_ok && `${m.non_ok}×4xx`, m.empty && `${m.empty}×empty`, m.timeout && `${m.timeout}×t/o`, m.error && `${m.error}×err`].filter(Boolean).join(", ")})` : "0"}
                          </td>
                          <td className="px-4 py-2 text-right text-muted-foreground">{ago(m.lastUsed)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent switches / failures */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-foreground mb-2">{c.recent}</h2>
            {data.recent.length === 0 ? (
              <p className="text-xs text-[var(--success,#16a34a)]">{c.noRecent}</p>
            ) : (
              <div className="bg-card border border-border rounded divide-y divide-border">
                {data.recent.map((r, i) => (
                  <div key={i} className="px-4 py-2 text-xs flex items-start gap-3">
                    <span className="font-mono text-muted-foreground whitespace-nowrap w-10">{ago(r.created_at)}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.tier}</span>
                    <span className="flex-1 min-w-0 font-mono break-all">
                      {r.failures.map((f, j) => (
                        <span key={j} className="text-[var(--warning,#d97706)]">{f.provider ? `${f.provider}:` : ""}{short(f.model)} <span className="text-muted-foreground">({f.reason}{f.status ? ` ${f.status}` : ""})</span>{j < r.failures.length - 1 ? ", " : ""} </span>
                      ))}
                      {r.answered_model ? (
                        <span className="text-[var(--success,#16a34a)]">→ {r.provider ? `${r.provider}:` : ""}{short(r.answered_model)} {c.answeredBy}</span>
                      ) : (
                        <span className="text-[var(--danger,#ef4444)]">→ {c.template}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
