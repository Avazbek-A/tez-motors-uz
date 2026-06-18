"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone, Loader2, Plus, Mic, Camera, Ship, Sparkles, ArrowUpRight } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface Call {
  id: string;
  customer_phone: string | null;
  direction: string;
  duration_sec: number | null;
  summary: string | null;
  lead_score: number | null;
  created_at: string;
}

const COPY: Record<Locale, {
  title: string;
  phonePlaceholder: string;
  inbound: string;
  outbound: string;
  durationPlaceholder: string;
  transcriptPlaceholder: string;
  saving: string;
  logCall: string;
  loading: string;
  noCalls: string;
  scorePrefix: string;
  minutesSuffix: string;
}> = {
  ru: {
    title: "Звонки",
    phonePlaceholder: "Телефон клиента",
    inbound: "Входящий",
    outbound: "Исходящий",
    durationPlaceholder: "Длительность (сек)",
    transcriptPlaceholder: "Вставьте расшифровку / заметки (необязательно) — авто-резюме + оценка",
    saving: "Сохранение…",
    logCall: "Записать звонок",
    loading: "Загрузка…",
    noCalls: "Звонки пока не записаны.",
    scorePrefix: "балл",
    minutesSuffix: "м",
  },
  uz: {
    title: "Qo‘ng‘iroqlar",
    phonePlaceholder: "Mijoz telefoni",
    inbound: "Kiruvchi",
    outbound: "Chiquvchi",
    durationPlaceholder: "Davomiyligi (son)",
    transcriptPlaceholder: "Transkript / eslatmalarni joylashtiring (ixtiyoriy) — avto-xulosa + baholash",
    saving: "Saqlanmoqda…",
    logCall: "Qo‘ng‘iroqni yozish",
    loading: "Yuklanmoqda…",
    noCalls: "Hozircha qo‘ng‘iroqlar yozilmagan.",
    scorePrefix: "ball",
    minutesSuffix: "daq",
  },
  en: {
    title: "Calls",
    phonePlaceholder: "Customer phone",
    inbound: "Inbound",
    outbound: "Outbound",
    durationPlaceholder: "Duration (sec)",
    transcriptPlaceholder: "Paste transcript / notes (optional) — auto-summarized + scored",
    saving: "Saving…",
    logCall: "Log call",
    loading: "Loading…",
    noCalls: "No calls logged yet.",
    scorePrefix: "score",
    minutesSuffix: "m",
  },
};

const LAUNCHERS: Record<Locale, Array<{
  title: string;
  desc: string;
  role: string;
  path: string;
  icon: "Phone" | "Camera" | "Ship" | "Sparkles" | "Mic";
  targetBlank?: boolean;
}>> = {
  ru: [
    { title: "Телефония и Продажи", desc: "Звонки VoIP, голосовые слепки, микротремор, ИИ-копилот.", role: "Менеджер по продажам", path: "/admin/calls/record", icon: "Phone" },
    { title: "Записи звонков", desc: "Записи с телефона (нативная запись iOS / диктофон): транскрипт, ИИ-анализ, плеер.", role: "Менеджер по продажам", path: "/admin/calls/recordings", icon: "Mic" },
    { title: "Посетители Шоурума (CV)", desc: "Компьютерное зрение на входе, логи посещений, сопоставление лиц.", role: "Администратор шоурума", path: "/admin/calls/showroom-cv", icon: "Camera" },
    { title: "Импорт и Логистика", desc: "Голосовое управление контейнерами, блокчейн-свопы, прогноз кэш-флоу.", role: "Менеджер логистики", path: "/admin/calls/logistics", icon: "Ship" },
    { title: "Интерактивный PWA клиента", desc: "3D-осмотр WebXR, AI-оценка Trade-In по фото и звуку двигателя.", role: "Публичный доступ", path: "/calls/customer", icon: "Sparkles", targetBlank: true }
  ],
  uz: [
    { title: "Telefoniya va Sotuvlar", desc: "VoIP qo'ng'iroqlari, ovozli nusxalar, mikro-tremor, AI-kopilot.", role: "Sotuv menejeri", path: "/admin/calls/record", icon: "Phone" },
    { title: "Qo'ng'iroq yozuvlari", desc: "Telefondan yozuvlar (iOS / diktofon): transkript, AI-tahlil, pleyer.", role: "Sotuv menejeri", path: "/admin/calls/recordings", icon: "Mic" },
    { title: "Showroom Tashriflari (CV)", desc: "Kirishda kompyuter ko'rishi, tashriflar jurnali, yuzlarni tanish.", role: "Showroom greeteri", path: "/admin/calls/showroom-cv", icon: "Camera" },
    { title: "Import va Logistika", desc: "Konteynerlarni ovozli boshqarish, blokcheyn-svoplar, kesh-flou prognozi.", role: "Logistika menejeri", path: "/admin/calls/logistics", icon: "Ship" },
    { title: "Mijozning interaktiv PWA-si", desc: "WebXR 3D-ko'rik, dvigatel ovozi va foto bo'yicha AI Trade-In baholash.", role: "Ochiq kirish", path: "/calls/customer", icon: "Sparkles", targetBlank: true }
  ],
  en: [
    { title: "VoIP & Sales Softphone", desc: "VoIP dialer, micro-tremor analysis, voice clones, AI coaching.", role: "Sales Representative", path: "/admin/calls/record", icon: "Phone" },
    { title: "Call Recordings", desc: "Phone-captured recordings (iOS native / voice memo): transcript, AI analysis, player.", role: "Sales Representative", path: "/admin/calls/recordings", icon: "Mic" },
    { title: "Showroom CV Greeter", desc: "Entrance computer vision feed, log entries, and CRM face matching.", role: "Showroom Greeter", path: "/admin/calls/showroom-cv", icon: "Camera" },
    { title: "Logistics & Forecast Hub", desc: "Voice container dispatching, P2P blockchain swap consensus, cash flow graph.", role: "Importer Logistics", path: "/admin/calls/logistics", icon: "Ship" },
    { title: "Customer Interactive PWA", desc: "WebXR 3D car rotation sync view, acoustic & photo AI Trade-In diagnostic.", role: "Public Customer", path: "/calls/customer", icon: "Sparkles", targetBlank: true }
  ]
};

export default function AdminCallsPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState("");
  const [direction, setDirection] = useState<"inbound" | "outbound">("inbound");
  const [duration, setDuration] = useState("");
  const [transcript, setTranscript] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/calls");
      const data = await res.json();
      setCalls(data.calls || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function logCall() {
    if (!phone.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/admin/calls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customer_phone: phone,
          direction,
          duration_sec: duration ? Number(duration) : null,
          transcript: transcript || null,
        }),
      });
      setPhone("");
      setDuration("");
      setTranscript("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  const launchers = LAUNCHERS[locale];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Phone className="h-5 w-5 text-lime" />
        <h1 className="text-xl font-bold">{t.title}</h1>
      </div>

      {/* Modular Launchers Grid */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            {locale === "ru" ? "Специализированные модули PWA" : locale === "uz" ? "Ixtisoslashtirilgan PWA modullari" : "Dedicated PWA Modules"}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {locale === "ru" ? "Выберите интерфейс в зависимости от вашей роли" : locale === "uz" ? "Rolingizga qarab kerakli interfeysni tanlang" : "Select a modular application role interface"}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {launchers.map((item) => {
            const Icon =
              item.icon === "Phone"
                ? Phone
                : item.icon === "Camera"
                ? Camera
                : item.icon === "Ship"
                ? Ship
                : item.icon === "Mic"
                ? Mic
                : Sparkles;

            return (
              <Link
                key={item.path}
                href={item.path}
                target={item.targetBlank ? "_blank" : undefined}
                className="group relative rounded-2xl border border-border bg-card p-5 space-y-4 shadow-md hover:border-lime/40 hover:shadow-lime/5 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="p-2.5 bg-muted rounded-xl border border-border/40 group-hover:bg-lime/10 group-hover:border-lime/20 group-hover:text-lime transition-all">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[8px] bg-muted px-2 py-0.5 border border-border rounded font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-all">
                      {item.role}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-foreground group-hover:text-lime transition-all flex items-center gap-1">
                      {item.title}
                      {item.targetBlank && <ArrowUpRight className="w-3 h-3 text-muted-foreground" />}
                    </h3>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap gap-2">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phonePlaceholder} className="rounded border border-border bg-muted px-3 py-2 text-sm" />
          <select value={direction} onChange={(e) => setDirection(e.target.value as "inbound" | "outbound")} className="rounded border border-border bg-muted px-3 py-2 text-sm">
            <option value="inbound">{t.inbound}</option>
            <option value="outbound">{t.outbound}</option>
          </select>
          <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder={t.durationPlaceholder} inputMode="numeric" className="w-32 rounded border border-border bg-muted px-3 py-2 text-sm" />
        </div>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={t.transcriptPlaceholder}
          rows={3}
          className="w-full rounded border border-border bg-muted px-3 py-2 text-sm"
        />
        <button onClick={logCall} disabled={saving || !phone.trim()} className="inline-flex items-center gap-1 rounded bg-lime px-3 py-2 text-sm font-medium text-navy disabled:opacity-50">
          <Plus className="h-4 w-4" /> {saving ? t.saving : t.logCall}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t.loading}
        </div>
      ) : calls.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.noCalls}</p>
      ) : (
        <div className="space-y-2">
          {calls.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-card p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{c.customer_phone || "—"}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="uppercase">{c.direction}</span>
                  {c.duration_sec != null && <span>{Math.round(c.duration_sec / 60)}{t.minutesSuffix}</span>}
                  {c.lead_score != null && (
                    <span className={c.lead_score >= 60 ? "text-lime" : c.lead_score >= 30 ? "text-yellow-400" : "text-muted-foreground"}>
                      {t.scorePrefix} {c.lead_score}
                    </span>
                  )}
                </span>
              </div>
              {c.summary && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{c.summary}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
