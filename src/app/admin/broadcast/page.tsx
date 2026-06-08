"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Megaphone, Loader2, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

const COPY: Record<Locale, {
  title: string;
  intro: string;
  onList: (count: ReactNode) => ReactNode;
  sentResult: (sent: number, recipients: number) => string;
  subjectPlaceholder: string;
  messagePlaceholder: string;
  sendBroadcast: string;
  confirmSend: (subject: string, count: number) => string;
}> = {
  ru: {
    title: "Рассылка",
    intro: "Отправьте объявление по email подписчикам вашей рассылки",
    onList: (count) => <> — {count} в списке</>,
    sentResult: (sent, recipients) => `Отправлено ${sent} из ${recipients} подписчиков.`,
    subjectPlaceholder: "Тема",
    messagePlaceholder: "Сообщение (обычный текст — переносы строк сохраняются)",
    sendBroadcast: "Отправить рассылку",
    confirmSend: (subject, count) => `Отправить «${subject}» ${count} подписчикам?`,
  },
  uz: {
    title: "Axborotnoma",
    intro: "E'lonni axborotnomangiz obunachilariga email orqali yuboring",
    onList: (count) => <> — ro&apos;yxatda {count} ta</>,
    sentResult: (sent, recipients) => `${recipients} obunachidan ${sent} tasiga yuborildi.`,
    subjectPlaceholder: "Mavzu",
    messagePlaceholder: "Xabar (oddiy matn — qator uzilishlari saqlanadi)",
    sendBroadcast: "Axborotnoma yuborish",
    confirmSend: (subject, count) => `«${subject}» ni ${count} ta obunachiga yuborilsinmi?`,
  },
  en: {
    title: "Broadcast",
    intro: "Email an announcement to your newsletter subscribers",
    onList: (count) => <> — {count} on the list</>,
    sentResult: (sent, recipients) => `Sent to ${sent} of ${recipients} subscribers.`,
    subjectPlaceholder: "Subject",
    messagePlaceholder: "Message (plain text — line breaks preserved)",
    sendBroadcast: "Send broadcast",
    confirmSend: (subject, count) => `Send "${subject}" to ${count} subscribers?`,
  },
};

export default function AdminBroadcastPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [subscribers, setSubscribers] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ recipients: number; sent: number } | null>(null);

  useEffect(() => {
    fetch("/api/admin/broadcast")
      .then((r) => r.json())
      .then((d) => setSubscribers(typeof d.subscribers === "number" ? d.subscribers : 0))
      .catch(() => setSubscribers(0));
  }, []);

  const send = async () => {
    if (!subject.trim() || !message.trim()) return;
    if (!confirm(t.confirmSend(subject, subscribers ?? 0))) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult({ recipients: data.recipients ?? 0, sent: data.sent ?? 0 });
        setSubject("");
        setMessage("");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-1">
        <Megaphone className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {t.intro}
        {subscribers != null && t.onList(<span className="font-mono text-foreground">{subscribers}</span>)}.
      </p>

      {result && (
        <div className="mb-6 flex items-center gap-2 bg-[var(--accent-tint)] border border-[var(--accent-line)] px-4 py-3 text-sm text-primary">
          <CheckCircle className="w-4 h-4" /> {t.sentResult(result.sent, result.recipients)}
        </div>
      )}

      <div className="bg-card border border-border p-5 space-y-4">
        <Input placeholder={t.subjectPlaceholder} value={subject} onChange={(e) => setSubject(e.target.value)} />
        <textarea
          placeholder={t.messagePlaceholder}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={8}
          className="w-full rounded-[2px] border border-border bg-[var(--bg-3)] px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--accent)] resize-none"
        />
        <Button onClick={send} disabled={sending || !subject.trim() || !message.trim()}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Megaphone className="w-4 h-4" /> {t.sendBroadcast}</>}
        </Button>
      </div>
    </div>
  );
}
