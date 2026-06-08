"use client";

import { useEffect, useState } from "react";
import { Workflow, Loader2, Plus, Trash2, Play, Pause } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface Step {
  delayHours: number;
  channel?: string;
  subject?: string;
  body: string;
  url?: string;
  buttonLabel?: string;
  ai?: boolean;
  aiPrompt?: string;
}
interface Journey {
  id: string;
  name: string;
  trigger_event: string;
  status: string;
  steps: Step[];
  step_count: number;
  enrolled_active: number;
  enrolled_completed: number;
  enrolled_converted: number;
  conversion_rate: number;
}

const TRIGGER_LABELS: Record<Locale, Record<string, string>> = {
  ru: {
    new_lead: "Новый лид",
    reservation_abandoned: "Бронь брошена",
    delivered: "Заказ доставлен",
    manual: "Вручную",
  },
  uz: {
    new_lead: "Yangi lid",
    reservation_abandoned: "Bron tashlab ketilgan",
    delivered: "Buyurtma yetkazilgan",
    manual: "Qo‘lda",
  },
  en: {
    new_lead: "New lead",
    reservation_abandoned: "Reservation abandoned",
    delivered: "Order delivered",
    manual: "Manual",
  },
};

const COPY: Record<Locale, {
  title: string;
  newJourney: string;
  intro1: string;
  intro2: string;
  placeholders: string;
  failedCreate: string;
  confirmDelete: string;
  journeyName: string;
  step: string;
  wait: string;
  bodyPlaceholder: string;
  linkUrl: string;
  buttonLabel: string;
  aiPersonalize: string;
  aiIntentPlaceholder: string;
  addStep: string;
  saving: string;
  createPaused: string;
  loading: string;
  noJourneys: string;
  steps: string;
  active: string;
  done: string;
  converted: string;
  pause: string;
  activate: string;
}> = {
  ru: {
    title: "Маркетинговая автоматизация",
    newJourney: "Новый сценарий",
    intro1: "Триггерные drip-цепочки. Контакт, попавший в триггер, зачисляется и проходит шаги; сообщения уходят сначала в Telegram, затем push/email/SMS. Новые сценарии стартуют ",
    intro2: " — активируйте, когда довольны текстом.",
    placeholders: "Плейсхолдеры: ",
    failedCreate: "Не удалось создать",
    confirmDelete: "Удалить этот сценарий и его зачисления?",
    journeyName: "Название сценария",
    step: "Шаг",
    wait: "ждать",
    bodyPlaceholder: "Текст сообщения (с {name}/{car}…) — также запасной вариант, если ИИ включён",
    linkUrl: "URL ссылки (необязательно)",
    buttonLabel: "текст кнопки",
    aiPersonalize: "ИИ-персонализация",
    aiIntentPlaceholder: "Цель ИИ, напр. «мягко подтолкнуть записаться на тест-драйв»",
    addStep: "+ шаг",
    saving: "Сохранение…",
    createPaused: "Создать (на паузе)",
    loading: "Загрузка…",
    noJourneys: "Пока нет сценариев. Создайте один, чтобы автоматизировать дожимы.",
    steps: "шагов",
    active: "активных",
    done: "завершено",
    converted: "конверсий",
    pause: "Пауза",
    activate: "Активировать",
  },
  uz: {
    title: "Marketing avtomatlashtirish",
    newJourney: "Yangi ssenariy",
    intro1: "Triggerga asoslangan drip-zanjirlar. Triggerga tushgan kontakt ro‘yxatga olinadi va bosqichlardan o‘tkaziladi; xabarlar avval Telegramga, so‘ng push/email/SMS orqali yuboriladi. Yangi ssenariylar ",
    intro2: " holatida boshlanadi — matndan mamnun bo‘lganingizda faollashtiring.",
    placeholders: "Pleysxolderlar: ",
    failedCreate: "Yaratib bo‘lmadi",
    confirmDelete: "Ushbu ssenariy va uning ro‘yxatlarini o‘chirilsinmi?",
    journeyName: "Ssenariy nomi",
    step: "Bosqich",
    wait: "kutish",
    bodyPlaceholder: "Xabar matni ({name}/{car}… bilan) — AI yoqilgan bo‘lsa, zaxira variant ham",
    linkUrl: "havola URL (ixtiyoriy)",
    buttonLabel: "tugma matni",
    aiPersonalize: "AI personalizatsiya",
    aiIntentPlaceholder: "AI maqsadi, masalan «test-drayvga yozilishga muloyim turtki»",
    addStep: "+ bosqich",
    saving: "Saqlanmoqda…",
    createPaused: "Yaratish (pauzada)",
    loading: "Yuklanmoqda…",
    noJourneys: "Hali ssenariylar yo‘q. Kuzatuvlarni avtomatlashtirish uchun bittasini yarating.",
    steps: "bosqich",
    active: "faol",
    done: "tugatilgan",
    converted: "konversiya",
    pause: "Pauza",
    activate: "Faollashtirish",
  },
  en: {
    title: "Marketing Automation",
    newJourney: "New journey",
    intro1: "Trigger-based drip sequences. A contact entering a trigger is enrolled and walked through the steps; messages go out Telegram-first, then push/email/SMS. New journeys start ",
    intro2: " — activate when you’re happy with the copy.",
    placeholders: "Placeholders: ",
    failedCreate: "Failed to create",
    confirmDelete: "Delete this journey and its enrollments?",
    journeyName: "Journey name",
    step: "Step",
    wait: "wait",
    bodyPlaceholder: "Message body (with {name}/{car}…) — also the fallback if AI is on",
    linkUrl: "link URL (optional)",
    buttonLabel: "button label",
    aiPersonalize: "AI personalize",
    aiIntentPlaceholder: "AI intent, e.g. 'gentle nudge to book a test drive'",
    addStep: "+ step",
    saving: "Saving…",
    createPaused: "Create (paused)",
    loading: "Loading…",
    noJourneys: "No journeys yet. Create one to start automating follow-ups.",
    steps: "steps",
    active: "active",
    done: "done",
    converted: "converted",
    pause: "Pause",
    activate: "Activate",
  },
};

const PAUSED_LABEL: Record<Locale, string> = { ru: "на паузе", uz: "pauzada", en: "paused" };
const STATUS_LABELS: Record<Locale, Record<string, string>> = {
  ru: { active: "активен", paused: "на паузе" },
  uz: { active: "faol", paused: "pauzada" },
  en: { active: "active", paused: "paused" },
};

export default function AdminAutomationPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const triggerLabels = TRIGGER_LABELS[locale];
  const statusLabels = STATUS_LABELS[locale];
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // New-journey form
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("new_lead");
  const [steps, setSteps] = useState<Step[]>([{ delayHours: 0, body: "" }]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/automation/journeys");
      const data = await res.json();
      setJourneys(data.journeys || []);
      setTriggers(data.triggers || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function setStep(i: number, patch: Partial<Step>) {
    setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  async function create() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/automation/journeys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), trigger_event: trigger, status: "paused", steps }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || t.failedCreate);
        return;
      }
      setName("");
      setSteps([{ delayHours: 0, body: "" }]);
      setCreating(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggle(j: Journey) {
    await fetch("/api/admin/automation/journeys", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: j.id, status: j.status === "active" ? "paused" : "active" }),
    });
    setJourneys((js) => js.map((x) => (x.id === j.id ? { ...x, status: x.status === "active" ? "paused" : "active" } : x)));
  }

  async function remove(id: string) {
    if (!confirm(t.confirmDelete)) return;
    await fetch(`/api/admin/automation/journeys?id=${id}`, { method: "DELETE" });
    setJourneys((js) => js.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-lime" />
          <h1 className="text-xl font-bold">{t.title}</h1>
        </div>
        <button onClick={() => setCreating((v) => !v)} className="inline-flex items-center gap-1 rounded bg-lime px-3 py-2 text-sm font-medium text-navy">
          <Plus className="h-4 w-4" /> {t.newJourney}
        </button>
      </div>
      <p className="text-sm text-white/50">
        {t.intro1}<strong>{PAUSED_LABEL[locale]}</strong>{t.intro2}{" "}
        {t.placeholders}<code className="text-white/70">{"{name} {car} {price} {ref}"}</code>.
      </p>

      {creating && (
        <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.journeyName} className="rounded border border-white/15 bg-black/20 px-3 py-2 text-sm" />
            <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className="rounded border border-white/15 bg-black/20 px-3 py-2 text-sm">
              {(triggers.length ? triggers : Object.keys(triggerLabels)).map((tr) => (
                <option key={tr} value={tr}>{triggerLabels[tr] || tr}</option>
              ))}
            </select>
          </div>
          {steps.map((s, i) => (
            <div key={i} className="rounded border border-white/10 bg-black/20 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-white/50">
                <span>{t.step} {i + 1}</span>
                <label className="flex items-center gap-1">
                  {t.wait}
                  <input type="number" min={0} value={s.delayHours} onChange={(e) => setStep(i, { delayHours: Number(e.target.value) })} className="w-20 rounded border border-white/15 bg-black/30 px-2 py-1" /> h
                </label>
                <select value={s.channel || "auto"} onChange={(e) => setStep(i, { channel: e.target.value })} className="rounded border border-white/15 bg-black/30 px-2 py-1">
                  <option value="auto">auto</option>
                  <option value="telegram">telegram</option>
                  <option value="email">email</option>
                  <option value="push">push</option>
                </select>
                {steps.length > 1 && (
                  <button onClick={() => setSteps((st) => st.filter((_, j) => j !== i))} className="ml-auto text-red-400 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </div>
              <textarea value={s.body} onChange={(e) => setStep(i, { body: e.target.value })} placeholder={t.bodyPlaceholder} rows={2} className="w-full rounded border border-white/15 bg-black/30 px-2 py-1 text-sm" />
              <div className="flex flex-wrap items-center gap-2">
                <input value={s.url || ""} onChange={(e) => setStep(i, { url: e.target.value })} placeholder={t.linkUrl} className="rounded border border-white/15 bg-black/30 px-2 py-1 text-xs" />
                <input value={s.buttonLabel || ""} onChange={(e) => setStep(i, { buttonLabel: e.target.value })} placeholder={t.buttonLabel} className="rounded border border-white/15 bg-black/30 px-2 py-1 text-xs" />
                <label className="flex items-center gap-1 text-xs text-white/60">
                  <input type="checkbox" checked={!!s.ai} onChange={(e) => setStep(i, { ai: e.target.checked })} /> {t.aiPersonalize}
                </label>
              </div>
              {s.ai && (
                <input value={s.aiPrompt || ""} onChange={(e) => setStep(i, { aiPrompt: e.target.value })} placeholder={t.aiIntentPlaceholder} className="w-full rounded border border-white/15 bg-black/30 px-2 py-1 text-xs" />
              )}
            </div>
          ))}
          <div className="flex items-center gap-2">
            {steps.length < 12 && (
              <button onClick={() => setSteps((s) => [...s, { delayHours: 24, body: "" }])} className="rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/10">{t.addStep}</button>
            )}
            <button onClick={create} disabled={saving || !name.trim() || steps.some((s) => !s.body.trim())} className="rounded bg-lime px-3 py-1.5 text-sm font-medium text-navy disabled:opacity-50">
              {saving ? t.saving : t.createPaused}
            </button>
            {err && <span className="text-sm text-red-400">{err}</span>}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-white/60"><Loader2 className="h-4 w-4 animate-spin" /> {t.loading}</div>
      ) : journeys.length === 0 ? (
        <p className="text-white/50 text-sm">{t.noJourneys}</p>
      ) : (
        <div className="space-y-2">
          {journeys.map((j) => (
            <div key={j.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-medium">{j.name}</span>
                  <span className="ml-2 text-xs text-white/50">{triggerLabels[j.trigger_event] || j.trigger_event} · {j.step_count} {t.steps}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50">
                    {j.enrolled_active} {t.active} · {j.enrolled_completed} {t.done}
                    {j.enrolled_converted > 0 && (
                      <span className="text-lime"> · {j.enrolled_converted} {t.converted} ({j.conversion_rate}%)</span>
                    )}
                  </span>
                  <span className={`rounded px-2 py-0.5 text-xs ${j.status === "active" ? "bg-lime/20 text-lime" : "bg-white/10 text-white/60"}`}>{statusLabels[j.status] || j.status}</span>
                  <button onClick={() => toggle(j)} className="rounded border border-white/15 p-1.5 hover:bg-white/10" title={j.status === "active" ? t.pause : t.activate}>
                    {j.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => remove(j.id)} className="rounded border border-white/15 p-1.5 text-red-400 hover:bg-white/10"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
