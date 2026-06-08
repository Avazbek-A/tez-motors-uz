"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, CheckCircle2, Circle, Settings, ShieldCheck, ShieldAlert, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, type SetupSummary, type IntegrationCategory } from "@/lib/setup-status";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

const ORDER: IntegrationCategory[] = ["core", "ai", "messaging", "payments", "marketing", "security"];

const COPY: Record<Locale, {
  title: string;
  intro: string;
  couldNotLoad: string;
  coreReady: string;
  coreIncomplete: string;
  coreSub: string;
  optionalConnected: string;
  required: string;
  connected: string;
  notSet: string;
  setPrefix: string;
  testConnection: string;
  sendTest: string;
  noResponse: string;
  requestFailed: string;
  channelSent: string;
  channelFailed: string;
  channelNotConfigured: string;
}> = {
  ru: {
    title: "Настройка и интеграции",
    intro:
      "Всё здесь работает из коробки и включает дополнительные возможности по мере подключения сервисов. Кроме ядра ничего не требуется — каждый переключатель ниже просто открывает больше. Секреты задаются как переменные окружения на вашем хосте; эта страница показывает только подключено ли что-то (значения никогда не отображаются).",
    couldNotLoad: "Не удалось загрузить статус.",
    coreReady: "Ядро готово",
    coreIncomplete: "Ядро не настроено",
    coreSub: "База данных + вход администратора",
    optionalConnected: "Подключено дополнительных интеграций",
    required: "обязательно",
    connected: "подключено",
    notSet: "не задано",
    setPrefix: "Задайте:",
    testConnection: "Проверить подключение",
    sendTest: "Отправить тест",
    noResponse: "нет ответа",
    requestFailed: "Запрос не выполнен.",
    channelSent: "✓ отправлено — проверьте почту/Telegram",
    channelFailed: "✗ настроено, но отправка не удалась",
    channelNotConfigured: "не настроено",
  },
  uz: {
    title: "Sozlash va integratsiyalar",
    intro:
      "Bu yerdagi hamma narsa darhol ishlaydi va xizmatlarni ulagan sayin qo'shimcha imkoniyatlarni yoqadi. Yadrodan tashqari hech narsa talab qilinmaydi — quyidagi har bir tugma shunchaki ko'proq imkoniyat ochadi. Maxfiy kalitlar hostingizda muhit o'zgaruvchilari sifatida o'rnatiladi; bu sahifa faqat har biri ulanganligini ko'rsatadi (qiymatlarni hech qachon).",
    couldNotLoad: "Holatni yuklab bo'lmadi.",
    coreReady: "Yadro tayyor",
    coreIncomplete: "Yadro to'liq emas",
    coreSub: "Ma'lumotlar bazasi + administrator kirishi",
    optionalConnected: "Ulangan qo'shimcha integratsiyalar",
    required: "majburiy",
    connected: "ulangan",
    notSet: "o'rnatilmagan",
    setPrefix: "O'rnating:",
    testConnection: "Ulanishni tekshirish",
    sendTest: "Test yuborish",
    noResponse: "javob yo'q",
    requestFailed: "So'rov bajarilmadi.",
    channelSent: "✓ yuborildi — pochta/Telegram'ni tekshiring",
    channelFailed: "✗ sozlangan, lekin yuborish muvaffaqiyatsiz",
    channelNotConfigured: "sozlanmagan",
  },
  en: {
    title: "Setup & integrations",
    intro:
      "Everything here works out of the box and turns on extra power as you connect services. Nothing is required beyond the core — each switch below just unlocks more. Secrets are set as environment variables on your host; this page only shows whether each is connected (never the values).",
    couldNotLoad: "Could not load status.",
    coreReady: "Core ready",
    coreIncomplete: "Core incomplete",
    coreSub: "Database + admin login",
    optionalConnected: "Optional integrations connected",
    required: "required",
    connected: "connected",
    notSet: "not set",
    setPrefix: "Set:",
    testConnection: "Test connection",
    sendTest: "Send test",
    noResponse: "no response",
    requestFailed: "Request failed.",
    channelSent: "✓ sent — check your inbox/Telegram",
    channelFailed: "✗ configured but send failed",
    channelNotConfigured: "not configured",
  },
};

export default function AdminSetupPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [data, setData] = useState<SetupSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingLlm, setTestingLlm] = useState(false);
  const [llmResult, setLlmResult] = useState<{ ok: boolean; message?: string; provider?: string; model?: string; sample?: string; latencyMs?: number } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/setup-status")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const testLlm = async () => {
    setTestingLlm(true);
    setLlmResult(null);
    try {
      const r = await fetch("/api/admin/llm/test", { method: "POST" });
      setLlmResult(await r.json());
    } catch {
      setLlmResult({ ok: false, message: t.requestFailed });
    } finally {
      setTestingLlm(false);
    }
  };

  const [testingNotify, setTestingNotify] = useState(false);
  const [notifyResult, setNotifyResult] = useState<{ telegram?: { configured: boolean; ok: boolean }; email?: { configured: boolean; ok: boolean } } | null>(null);
  const testNotify = async () => {
    setTestingNotify(true);
    setNotifyResult(null);
    try {
      const r = await fetch("/api/admin/notify/test", { method: "POST" });
      setNotifyResult(await r.json());
    } catch {
      setNotifyResult(null);
    } finally {
      setTestingNotify(false);
    }
  };
  const channelMsg = (c?: { configured: boolean; ok: boolean }) =>
    !c ? "" : c.ok ? t.channelSent : c.configured ? t.channelFailed : t.channelNotConfigured;

  const grouped = (cat: IntegrationCategory) => data?.integrations.filter((i) => i.category === cat) ?? [];

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        {t.intro}
      </p>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">{t.couldNotLoad}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 mb-6">
            <div className={`border p-3 rounded-[2px] ${data.coreReady ? "border-[var(--success)]/40" : "border-[var(--danger)]/40"}`}>
              <div className="flex items-center gap-2">
                {data.coreReady ? <ShieldCheck className="w-4 h-4 text-[var(--success)]" /> : <ShieldAlert className="w-4 h-4 text-[var(--danger)]" />}
                <p className="text-sm font-medium text-foreground">{data.coreReady ? t.coreReady : t.coreIncomplete}</p>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{t.coreSub}</p>
            </div>
            <div className="border border-border p-3 rounded-[2px]">
              <p className="font-mono text-lg font-semibold text-foreground">{data.activeOptional}/{data.totalOptional}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t.optionalConnected}</p>
            </div>
          </div>

          {ORDER.map((cat) => {
            const items = grouped(cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="mb-5">
                <p className="px-1 pb-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{CATEGORY_LABELS[cat]}</p>
                <div className="space-y-2">
                  {items.map((i) => (
                    <div key={i.key} className="bg-card border border-border p-3 flex items-start gap-3">
                      {i.active
                        ? <CheckCircle2 className="w-5 h-5 text-[var(--success)] shrink-0 mt-0.5" />
                        : <Circle className="w-5 h-5 text-muted-foreground/50 shrink-0 mt-0.5" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{i.label}</p>
                          {i.required && <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--danger)] border border-[var(--danger)]/40 rounded px-1">{t.required}</span>}
                          <span className={`text-[10px] font-mono uppercase ${i.active ? "text-[var(--success)]" : "text-muted-foreground"}`}>{i.active ? t.connected : t.notSet}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{i.unlocks}</p>
                        {!i.active && (
                          <p className="text-[11px] text-muted-foreground/80 mt-1">
                            {t.setPrefix} {i.missing.map((v) => <code key={v} className="text-foreground bg-[var(--bg-3)] px-1 rounded mr-1">{v}</code>)}
                          </p>
                        )}
                        {i.key === "llm" && (
                          <div className="mt-2">
                            <Button type="button" variant="outline" size="sm" onClick={testLlm} disabled={testingLlm}>
                              {testingLlm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} {t.testConnection}
                            </Button>
                            {llmResult && (
                              <p className={`text-[11px] mt-1.5 ${llmResult.ok ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
                                {llmResult.ok
                                  ? `✓ ${llmResult.provider} · ${llmResult.model} · ${llmResult.latencyMs}ms — "${llmResult.sample}"`
                                  : `✗ ${llmResult.message || t.noResponse}`}
                              </p>
                            )}
                          </div>
                        )}
                        {(i.key === "telegram_alerts" || i.key === "email") && (
                          <div className="mt-2">
                            <Button type="button" variant="outline" size="sm" onClick={testNotify} disabled={testingNotify}>
                              {testingNotify ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} {t.sendTest}
                            </Button>
                            {notifyResult && (
                              <p className={`text-[11px] mt-1.5 ${(i.key === "telegram_alerts" ? notifyResult.telegram?.ok : notifyResult.email?.ok) ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
                                {channelMsg(i.key === "telegram_alerts" ? notifyResult.telegram : notifyResult.email)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
