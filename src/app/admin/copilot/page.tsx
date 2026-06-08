"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Check, X } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface Msg {
  role: "user" | "assistant";
  text: string;
  proposed?: boolean;
  executed?: boolean;
}

const COPY: Record<Locale, {
  greeting: string;
  connectionError: string;
  title: string;
  confirm: string;
  cancel: string;
  done: string;
  thinking: string;
  placeholder: string;
  suggestions: string[];
}> = {
  ru: {
    greeting: "Привет! Я ваш бизнес-ассистент. Спросите о деньгах, спросе, заявках — или дайте команду: «снизь цену на …», «переведи заказ TM-… », «закажи … у поставщика». Действия выполняю только после вашего подтверждения.",
    connectionError: "Ошибка связи. Попробуйте ещё раз.",
    title: "Dealer Copilot",
    confirm: "Подтвердить",
    cancel: "Отмена",
    done: "✓ Выполнено",
    thinking: "думаю…",
    placeholder: "Спросите или дайте команду…",
    suggestions: [
      "Сводка по бизнесу",
      "Сколько у меня денег?",
      "Какой спрос сейчас?",
      "Что залежалось на складе?",
      "Новые заявки",
    ],
  },
  uz: {
    greeting: "Salom! Men sizning biznes-yordamchingizman. Pul, talab, so'rovlar haqida so'rang — yoki buyruq bering: «… narxini tushir», «TM-… buyurtmasini o'tkaz», «yetkazib beruvchidan … buyurtma qil». Amallarni faqat tasdiqlaganingizdan keyin bajaraman.",
    connectionError: "Aloqa xatosi. Qayta urinib ko'ring.",
    title: "Dealer Copilot",
    confirm: "Tasdiqlash",
    cancel: "Bekor qilish",
    done: "✓ Bajarildi",
    thinking: "o'ylayapman…",
    placeholder: "So'rang yoki buyruq bering…",
    suggestions: [
      "Biznes bo'yicha xulosa",
      "Mendagi pul qancha?",
      "Hozir qanday talab bor?",
      "Omborda nima qolib ketgan?",
      "Yangi so'rovlar",
    ],
  },
  en: {
    greeting: "Hi! I'm your business assistant. Ask about money, demand, inquiries — or give a command: \"drop the price on …\", \"move order TM-…\", \"order … from the supplier\". I only execute actions after your confirmation.",
    connectionError: "Connection error. Please try again.",
    title: "Dealer Copilot",
    confirm: "Confirm",
    cancel: "Cancel",
    done: "✓ Done",
    thinking: "thinking…",
    placeholder: "Ask or give a command…",
    suggestions: [
      "Business summary",
      "How much money do I have?",
      "What's the demand right now?",
      "What's sitting in stock?",
      "New inquiries",
    ],
  },
};

export default function AdminCopilotPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: t.greeting },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const threadId = useRef<string>("web");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Stable per-browser thread so confirm-gating spans turns.
    try {
      let t = localStorage.getItem("copilot_thread");
      if (!t) { t = `web-${Math.random().toString(36).slice(2, 10)}`; localStorage.setItem("copilot_thread", t); }
      threadId.current = t;
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send(text: string, confirm = false) {
    if (!text.trim() || busy) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, threadId: threadId.current, confirm }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", text: data.reply || "…", proposed: data.proposed, executed: data.executed }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: t.connectionError }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
      <div className="mb-4 flex items-center gap-2">
        <Bot className="h-5 w-5 text-[var(--accent)]" />
        <h1 className="text-lg font-semibold">{t.title}</h1>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-[var(--accent)] text-white" : "bg-[var(--muted)] text-foreground"}`}>
              {m.text}
              {m.proposed && (
                <div className="mt-2 flex gap-2">
                  <button onClick={() => send("да", true)} disabled={busy} className="inline-flex items-center gap-1 rounded bg-[var(--success)] px-2 py-1 text-xs text-white disabled:opacity-50">
                    <Check className="h-3 w-3" /> {t.confirm}
                  </button>
                  <button onClick={() => send("нет")} disabled={busy} className="inline-flex items-center gap-1 rounded bg-[var(--muted)] px-2 py-1 text-xs disabled:opacity-50">
                    <X className="h-3 w-3" /> {t.cancel}
                  </button>
                </div>
              )}
              {m.executed && <div className="mt-1 text-xs text-[var(--success)]">{t.done}</div>}
            </div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {t.thinking}</div>}
        <div ref={endRef} />
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {t.suggestions.map((s) => (
          <button key={s} onClick={() => send(s)} disabled={busy} className="rounded-full border border-[var(--border)] px-2 py-1 text-xs text-muted-foreground hover:bg-[var(--muted)] disabled:opacity-50">{s}</button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-2 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.placeholder}
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <button type="submit" disabled={busy || !input.trim()} className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
