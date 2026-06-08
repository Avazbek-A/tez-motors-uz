"use client";

import { useEffect, useState } from "react";
import { Phone, Loader2, Plus } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Phone className="h-5 w-5 text-lime" />
        <h1 className="text-xl font-bold">{t.title}</h1>
      </div>

      <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap gap-2">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phonePlaceholder} className="rounded border border-white/15 bg-black/20 px-3 py-2 text-sm" />
          <select value={direction} onChange={(e) => setDirection(e.target.value as "inbound" | "outbound")} className="rounded border border-white/15 bg-black/20 px-3 py-2 text-sm">
            <option value="inbound">{t.inbound}</option>
            <option value="outbound">{t.outbound}</option>
          </select>
          <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder={t.durationPlaceholder} inputMode="numeric" className="w-32 rounded border border-white/15 bg-black/20 px-3 py-2 text-sm" />
        </div>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={t.transcriptPlaceholder}
          rows={3}
          className="w-full rounded border border-white/15 bg-black/20 px-3 py-2 text-sm"
        />
        <button onClick={logCall} disabled={saving || !phone.trim()} className="inline-flex items-center gap-1 rounded bg-lime px-3 py-2 text-sm font-medium text-navy disabled:opacity-50">
          <Plus className="h-4 w-4" /> {saving ? t.saving : t.logCall}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> {t.loading}
        </div>
      ) : calls.length === 0 ? (
        <p className="text-white/50 text-sm">{t.noCalls}</p>
      ) : (
        <div className="space-y-2">
          {calls.map((c) => (
            <div key={c.id} className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{c.customer_phone || "—"}</span>
                <span className="flex items-center gap-2 text-xs text-white/50">
                  <span className="uppercase">{c.direction}</span>
                  {c.duration_sec != null && <span>{Math.round(c.duration_sec / 60)}{t.minutesSuffix}</span>}
                  {c.lead_score != null && (
                    <span className={c.lead_score >= 60 ? "text-lime" : c.lead_score >= 30 ? "text-yellow-400" : "text-white/50"}>
                      {t.scorePrefix} {c.lead_score}
                    </span>
                  )}
                </span>
              </div>
              {c.summary && <p className="mt-1 whitespace-pre-wrap text-white/70">{c.summary}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
