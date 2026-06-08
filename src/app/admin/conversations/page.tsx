"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Loader2, X, Flame, ExternalLink } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface Convo {
  thread_id: string;
  channel: string;
  locale: string;
  stage: string;
  lead_score: number;
  name: string | null;
  phone: string | null;
  handoff: boolean;
  handoff_reason: string | null;
  inquiry_id: string | null;
  message_count: number;
  last_message_at: string;
  profile_summary: string;
}

interface Msg {
  role: string;
  content: string;
  created_at: string;
}

const STAGE_TONE: Record<string, string> = {
  greeting: "text-muted-foreground border-border",
  qualifying: "text-[var(--info)] border-[var(--info)]",
  recommending: "text-[var(--info)] border-[var(--info)]",
  closing: "text-[var(--warning)] border-[var(--warning)]",
  handoff: "text-[var(--success)] border-[var(--success)]",
};

const fmt = (s: string) => {
  try {
    return new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return s;
  }
};

const COPY: Record<Locale, {
  title: string;
  handoffOnly: string;
  subtitle: string;
  noConversations: string;
  thStage: string;
  thScore: string;
  thLookingFor: string;
  thContact: string;
  thMsgs: string;
  thLast: string;
  conversation: string;
  score: string;
  msgs: string;
  viewLead: string;
  noMessages: string;
}> = {
  ru: {
    title: "AI-диалоги продаж",
    handoffOnly: "Только передачи",
    subtitle: "Кого ассистент квалифицирует прямо сейчас. Горячие лиды, готовые к менеджеру, помечены — нажмите на строку, чтобы прочитать переписку и связаться.",
    noConversations: "Диалогов пока нет.",
    thStage: "Этап",
    thScore: "Балл",
    thLookingFor: "Ищет",
    thContact: "Контакт",
    thMsgs: "Сообщ.",
    thLast: "Посл.",
    conversation: "Диалог",
    score: "балл",
    msgs: "сообщ.",
    viewLead: "Открыть лид в запросах",
    noMessages: "Сообщения не сохранены.",
  },
  uz: {
    title: "AI sotuv suhbatlari",
    handoffOnly: "Faqat topshiriqlar",
    subtitle: "Assistent hozir kimni baholayotgani. Menejerga tayyor qaynoq lidlar belgilangan — yozishmani o‘qish va bog‘lanish uchun qatorga bosing.",
    noConversations: "Hozircha suhbatlar yo‘q.",
    thStage: "Bosqich",
    thScore: "Ball",
    thLookingFor: "Qidirmoqda",
    thContact: "Kontakt",
    thMsgs: "Xabar.",
    thLast: "Oxirgi",
    conversation: "Suhbat",
    score: "ball",
    msgs: "xabar",
    viewLead: "Lidni so‘rovlarda ochish",
    noMessages: "Xabarlar saqlanmagan.",
  },
  en: {
    title: "AI sales conversations",
    handoffOnly: "Handoff only",
    subtitle: "What the assistant is qualifying right now. Hot leads ready for a human are flagged — click any row to read the transcript and follow up.",
    noConversations: "No conversations yet.",
    thStage: "Stage",
    thScore: "Score",
    thLookingFor: "Looking for",
    thContact: "Contact",
    thMsgs: "Msgs",
    thLast: "Last",
    conversation: "Conversation",
    score: "score",
    msgs: "msgs",
    viewLead: "View lead in inquiries",
    noMessages: "No messages stored.",
  },
};

export default function AdminConversationsPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [rows, setRows] = useState<Convo[]>([]);
  const [loading, setLoading] = useState(true);
  const [handoffOnly, setHandoffOnly] = useState(false);
  const [open, setOpen] = useState<{ convo: Convo; messages: Msg[] } | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/conversations")
      .then((r) => r.json())
      .then((d) => setRows(d.conversations || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openThread = async (convo: Convo) => {
    setLoadingThread(true);
    setOpen({ convo, messages: [] });
    try {
      const res = await fetch(`/api/admin/conversations?thread_id=${encodeURIComponent(convo.thread_id)}`);
      const d = await res.json();
      setOpen({ convo, messages: d.messages || [] });
    } finally {
      setLoadingThread(false);
    }
  };

  const visible = handoffOnly ? rows.filter((r) => r.handoff) : rows;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={handoffOnly} onChange={(e) => setHandoffOnly(e.target.checked)} />
          {t.handoffOnly}
        </label>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {t.subtitle}
      </p>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.noConversations}</p>
      ) : (
        <div className="bg-card border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-4 py-2 font-medium">{t.thStage}</th>
                <th className="px-4 py-2 font-medium text-right">{t.thScore}</th>
                <th className="px-4 py-2 font-medium">{t.thLookingFor}</th>
                <th className="px-4 py-2 font-medium">{t.thContact}</th>
                <th className="px-4 py-2 font-medium text-right">{t.thMsgs}</th>
                <th className="px-4 py-2 font-medium">{t.thLast}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr
                  key={c.thread_id}
                  onClick={() => openThread(c)}
                  className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/40"
                >
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border rounded-[2px] ${STAGE_TONE[c.stage] || "text-muted-foreground border-border"}`}>
                      {c.handoff && <Flame className="w-3 h-3" />}{c.stage}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground">{c.lead_score}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.profile_summary}</td>
                  <td className="px-4 py-2.5 text-foreground">
                    {c.phone ? <span>{c.name ? `${c.name} · ` : ""}{c.phone}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{c.message_count}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{fmt(c.last_message_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(null)} />
          <div className="relative z-10 w-full max-w-lg bg-card border border-border p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-semibold text-foreground">{t.conversation}</h2>
                <p className="text-xs text-muted-foreground">
                  {open.convo.profile_summary} · {t.score} {open.convo.lead_score} · {open.convo.message_count} {t.msgs}
                </p>
                {open.convo.phone && (
                  <p className="text-sm text-foreground mt-1">
                    {open.convo.name ? `${open.convo.name} · ` : ""}
                    <a href={`tel:${open.convo.phone}`} className="text-primary hover:underline">{open.convo.phone}</a>
                  </p>
                )}
                {open.convo.inquiry_id && (
                  <Link href="/admin/inquiries" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                    <ExternalLink className="w-3 h-3" /> {t.viewLead}
                  </Link>
                )}
              </div>
              <button onClick={() => setOpen(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            {loadingThread ? (
              <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" /></div>
            ) : (
              <div className="space-y-2">
                {open.messages.map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-[2px] px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "assistant" ? "bg-[var(--bg-3)] text-foreground" : "bg-[var(--accent-tint)] text-foreground ml-6"}`}
                  >
                    <span className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">{m.role}</span>
                    {m.content}
                  </div>
                ))}
                {open.messages.length === 0 && <p className="text-sm text-muted-foreground">{t.noMessages}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
