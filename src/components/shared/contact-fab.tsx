"use client";

import { useState, useEffect } from "react";
import { MessageCircle, X, Phone, Send, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Turnstile } from "@/components/shared/turnstile";
import { useSiteSettings } from "@/lib/site-settings-context";
import { useLocale } from "@/i18n/locale-context";
import { cn, whatsappLink, telegramLink } from "@/lib/utils";

/**
 * Single expandable contact FAB (replaces the old 3-button floating stack).
 * Tap → fans out Telegram / WhatsApp / Call-back. Less persistent screen
 * real-estate and no collision with the cookie banner.
 */
export function ContactFab() {
  const settings = useSiteSettings();
  const { locale } = useLocale();
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [callbackOpen, setCallbackOpen] = useState(false);

  // callback form state
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const L = {
    ru: { open: "Связаться", tg: "Telegram", wa: "WhatsApp", cb: "Обратный звонок", title: "Перезвоните мне", name: "Ваше имя", phone: "Телефон", submit: "Жду звонка", ok: "Мы перезвоним!", err: "Ошибка отправки. Попробуйте ещё раз.", greet: "Здравствуйте! У меня вопрос по автомобилям Tez Motors." },
    uz: { open: "Bog'lanish", tg: "Telegram", wa: "WhatsApp", cb: "Qo'ng'iroq", title: "Menga qo'ng'iroq qiling", name: "Ismingiz", phone: "Telefon", submit: "Qo'ng'iroq kutaman", ok: "Qo'ng'iroq qilamiz!", err: "Yuborishda xatolik. Qayta urinib ko'ring.", greet: "Assalomu alaykum! Tez Motors avtomobillari bo'yicha savolim bor." },
    en: { open: "Contact", tg: "Telegram", wa: "WhatsApp", cb: "Call me back", title: "Call me back", name: "Your name", phone: "Phone", submit: "Request callback", ok: "We'll call you!", err: "Failed to send. Please try again.", greet: "Hello! I have a question about Tez Motors cars." },
  };
  const t = L[locale as keyof typeof L] || L.ru;

  const wa = whatsappLink(settings.whatsapp, t.greet);
  const tg = telegramLink(settings.telegram);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, turnstile_token: token ?? undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || t.err);
        return;
      }
      setSuccess(true);
      setName("");
      setPhone("");
      setTimeout(() => { setSuccess(false); setCallbackOpen(false); }, 3000);
    } catch {
      setError(t.err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) return null;

  const mini = "w-12 h-12 rounded-full bg-card border flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110";
  const pill = "text-xs font-medium px-2.5 py-1 rounded-full bg-card border border-border text-foreground shadow";

  return (
    <>
      {/* Call-back form */}
      {callbackOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[min(20rem,calc(100vw-3rem))] animate-fade-in-up">
          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-xl">
            <div className="bg-primary/10 border-b border-border text-foreground p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm">{t.title}</span>
              </div>
              <button onClick={() => setCallbackOpen(false)} className="text-foreground/60 hover:text-foreground" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              {success ? (
                <div className="text-center py-4">
                  <CheckCircle className="w-10 h-10 text-[var(--success)] mx-auto mb-2" />
                  <p className="font-semibold text-sm text-foreground">{t.ok}</p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-3">
                  <Input placeholder={t.name} value={name} onChange={(e) => setName(e.target.value)} required className="h-10 text-sm" />
                  <Input type="tel" placeholder={t.phone} value={phone} onChange={(e) => setPhone(e.target.value)} required className="h-10 text-sm" />
                  <Turnstile onToken={setToken} />
                  {error && (
                    <p className="text-xs text-[var(--danger)] flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
                    </p>
                  )}
                  <Button type="submit" size="sm" className="w-full" disabled={submitting}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" />{t.submit}</>}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fanned-out options */}
      {expanded && !callbackOpen && (
        <div className="fixed bottom-24 right-6 z-40 flex flex-col items-end gap-3 animate-fade-in-up">
          {tg && (
            <a href={tg} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2" aria-label={t.tg}>
              <span className={pill}>{t.tg}</span>
              <span className={cn(mini, "border-[#229ED9]/60 text-[#229ED9] hover:bg-[#229ED9]/10")}>
                <Send className="w-5 h-5" />
              </span>
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2" aria-label={t.wa}>
              <span className={pill}>{t.wa}</span>
              <span className={cn(mini, "border-[var(--success)]/60 text-[var(--success)] hover:bg-[var(--success)]/10")}>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
              </span>
            </a>
          )}
          <button onClick={() => { setCallbackOpen(true); setExpanded(false); }} className="flex items-center gap-2" aria-label={t.cb}>
            <span className={pill}>{t.cb}</span>
            <span className={cn(mini, "border-[var(--accent-deep)]/60 text-[var(--accent-deep)] hover:bg-[var(--accent-tint)]")}>
              <Phone className="w-5 h-5" />
            </span>
          </button>
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={() => { setExpanded((v) => !v); if (callbackOpen) setCallbackOpen(false); }}
        aria-label={t.open}
        aria-expanded={expanded}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110"
      >
        {expanded || callbackOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </>
  );
}
