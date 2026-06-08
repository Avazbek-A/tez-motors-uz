"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Send, Loader2, Users2, Mail, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface SegmentDef {
  key: string;
  label: string;
  description: string;
  channels: ("email" | "sms")[];
}

interface Detail {
  count: number;
  withEmail: number;
  withPhone: number;
  sample: { name: string | null; phone: string | null; email: string | null }[];
}

const COPY: Record<Locale, {
  title: string;
  intro: (name: ReactNode) => ReactNode;
  selectAudience: string;
  contactsLine: (c: number, p: number, e: number) => string;
  subjectPlaceholder: string;
  smsPlaceholder: string;
  emailPlaceholder: string;
  recipients: (n: number) => string;
  send: string;
  previewRecipients: (n: number) => string;
  noEmail: string;
  noPhone: string;
  confirmSend: (channel: string, count: number, label: string) => string;
  sentResult: (sent: number, targeted: number, failed: number, capped: number) => string;
  sendFailed: string;
}> = {
  ru: {
    title: "Кампании",
    intro: (name) => <>Выберите аудиторию, напишите сообщение, отправьте по SMS или email. Используйте {name} для персонализации. Ограничено 300 получателями за отправку.</>,
    selectAudience: "Выберите аудиторию, чтобы создать кампанию.",
    contactsLine: (c, p, e) => `${c} контактов · ${p} доступны по SMS · ${e} по email`,
    subjectPlaceholder: "Тема",
    smsPlaceholder: "Короткий текст SMS. Привет {name}, …",
    emailPlaceholder: "Текст письма. Привет {name}, …",
    recipients: (n) => `→ ${n} получателей`,
    send: "Отправить",
    previewRecipients: (n) => `Предпросмотр получателей (${n})`,
    noEmail: "(нет email)",
    noPhone: "(нет телефона)",
    confirmSend: (channel, count, label) => `Отправить это ${channel} ${count} контактам в «${label}»? Это отправит реальные сообщения.`,
    sentResult: (sent, targeted, failed, capped) => `Отправлено ${sent} / ${targeted}${failed ? `, ${failed} с ошибкой` : ""}${capped ? ` · ${capped} сверх лимита 300 не отправлено` : ""}.`,
    sendFailed: "Ошибка отправки.",
  },
  uz: {
    title: "Kampaniyalar",
    intro: (name) => <>Auditoriyani tanlang, xabar yozing, SMS yoki email orqali yuboring. Shaxsiylashtirish uchun {name} dan foydalaning. Bir yuborishda 300 qabul qiluvchi bilan cheklangan.</>,
    selectAudience: "Kampaniya yaratish uchun auditoriyani tanlang.",
    contactsLine: (c, p, e) => `${c} ta kontakt · ${p} ta SMS orqali · ${e} ta email orqali`,
    subjectPlaceholder: "Mavzu",
    smsPlaceholder: "Qisqa SMS matni. Salom {name}, …",
    emailPlaceholder: "Email matni. Salom {name}, …",
    recipients: (n) => `→ ${n} ta qabul qiluvchi`,
    send: "Yuborish",
    previewRecipients: (n) => `Qabul qiluvchilarni ko'rish (${n})`,
    noEmail: "(email yo'q)",
    noPhone: "(telefon yo'q)",
    confirmSend: (channel, count, label) => `Ushbu ${channel} ni «${label}» dagi ${count} ta kontaktga yuborilsinmi? Bu haqiqiy xabarlar yuboradi.`,
    sentResult: (sent, targeted, failed, capped) => `Yuborildi ${sent} / ${targeted}${failed ? `, ${failed} xato` : ""}${capped ? ` · ${capped} ta 300 limitdan oshib yuborilmadi` : ""}.`,
    sendFailed: "Yuborish amalga oshmadi.",
  },
  en: {
    title: "Campaigns",
    intro: (name) => <>Pick an audience, write a message, send by SMS or email. Use {name} to personalize. Capped at 300 recipients per send.</>,
    selectAudience: "Select an audience to compose a campaign.",
    contactsLine: (c, p, e) => `${c} contacts · ${p} reachable by SMS · ${e} by email`,
    subjectPlaceholder: "Subject",
    smsPlaceholder: "Short SMS text. Hi {name}, …",
    emailPlaceholder: "Email body. Hi {name}, …",
    recipients: (n) => `→ ${n} recipients`,
    send: "Send",
    previewRecipients: (n) => `Preview recipients (${n})`,
    noEmail: "(no email)",
    noPhone: "(no phone)",
    confirmSend: (channel, count, label) => `Send this ${channel} to ${count} contacts in "${label}"? This sends real messages.`,
    sentResult: (sent, targeted, failed, capped) => `Sent ${sent} / ${targeted}${failed ? `, ${failed} failed` : ""}${capped ? ` · ${capped} over the 300 cap not sent` : ""}.`,
    sendFailed: "Send failed.",
  },
};

export default function AdminSegmentsPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [segments, setSegments] = useState<SegmentDef[]>([]);
  const [selected, setSelected] = useState<SegmentDef | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [channel, setChannel] = useState<"email" | "sms">("sms");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/segments")
      .then((r) => r.json())
      .then((d) => setSegments(d.segments || []));
  }, []);

  const select = useCallback(async (def: SegmentDef) => {
    setSelected(def);
    setDetail(null);
    setResult(null);
    setChannel(def.channels[0]);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/segments?segment=${def.key}`);
      const d = await res.json();
      setDetail({ count: d.count, withEmail: d.withEmail, withPhone: d.withPhone, sample: d.sample || [] });
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const send = async () => {
    if (!selected || body.trim().length < 4) return;
    const reach = channel === "email" ? detail?.withEmail || 0 : detail?.withPhone || 0;
    if (!confirm(t.confirmSend(channel.toUpperCase(), Math.min(reach, 300), selected.label))) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/segments/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment: selected.key, channel, subject: subject || undefined, body }),
      });
      const d = await res.json();
      if (res.ok) {
        setResult(t.sentResult(d.sent, d.targeted, d.failed || 0, d.capped || 0));
        setBody("");
        setSubject("");
      } else {
        setResult(d.error || t.sendFailed);
      }
    } finally {
      setSending(false);
    }
  };

  const reach = channel === "email" ? detail?.withEmail || 0 : detail?.withPhone || 0;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <Send className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {t.intro(<code className="text-foreground">{"{name}"}</code>)}
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Segment list */}
        <div className="space-y-2">
          {segments.map((s) => (
            <button
              key={s.key}
              onClick={() => select(s)}
              className={`w-full text-left bg-card border p-3 rounded-[2px] transition-colors ${selected?.key === s.key ? "border-[var(--accent)]" : "border-border hover:border-[var(--accent-line)]"}`}
            >
              <div className="flex items-center gap-2">
                <Users2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{s.label}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
            </button>
          ))}
        </div>

        {/* Compose */}
        <div>
          {!selected ? (
            <p className="text-sm text-muted-foreground">{t.selectAudience}</p>
          ) : (
            <div className="bg-card border border-border p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">{selected.label}</h2>
              {loadingDetail ? (
                <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" /></div>
              ) : detail ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    {t.contactsLine(detail.count, detail.withPhone, detail.withEmail)}
                  </p>
                  <div className="flex gap-1">
                    {selected.channels.map((ch) => (
                      <button
                        key={ch}
                        onClick={() => setChannel(ch)}
                        className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-mono uppercase rounded-[2px] border ${channel === ch ? "border-[var(--accent)] text-primary" : "border-border text-muted-foreground"}`}
                      >
                        {ch === "email" ? <Mail className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />} {ch}
                      </button>
                    ))}
                  </div>
                  {channel === "email" && (
                    <Input placeholder={t.subjectPlaceholder} value={subject} onChange={(e) => setSubject(e.target.value)} className="text-sm" />
                  )}
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={channel === "sms" ? t.smsPlaceholder : t.emailPlaceholder}
                    rows={channel === "sms" ? 3 : 6}
                    className="w-full rounded-[2px] border border-border bg-[var(--bg-3)] px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--accent)]"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{t.recipients(Math.min(reach, 300))}</span>
                    <Button size="sm" onClick={send} disabled={sending || body.trim().length < 4 || reach === 0 || (channel === "email" && !subject)}>
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> {t.send}</>}
                    </Button>
                  </div>
                  {result && <p className="text-xs text-primary">{result}</p>}
                  {detail.sample.length > 0 && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">{t.previewRecipients(detail.sample.length)}</summary>
                      <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
                        {detail.sample.map((c, i) => (
                          <div key={i} className="font-mono">{c.name || "—"} · {channel === "email" ? c.email || t.noEmail : c.phone || t.noPhone}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
