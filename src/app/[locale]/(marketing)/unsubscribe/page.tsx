"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";

const COPY = {
  ru: { title: "Отписка от рассылки", body: "Нажмите кнопку, чтобы больше не получать автоматические сообщения от Tez Motors.", btn: "Отписаться", done: "Готово — вы отписаны. Больше не будем беспокоить.", err: "Ссылка недействительна или устарела.", missing: "Неверная ссылка." },
  uz: { title: "Obunani bekor qilish", body: "Tez Motors'dan avtomatik xabarlarni olishni to'xtatish uchun tugmani bosing.", btn: "Obunani bekor qilish", done: "Tayyor — obuna bekor qilindi. Endi bezovta qilmaymiz.", err: "Havola yaroqsiz yoki eskirgan.", missing: "Noto'g'ri havola." },
  en: { title: "Unsubscribe", body: "Click below to stop receiving automated messages from Tez Motors.", btn: "Unsubscribe", done: "Done — you're unsubscribed. We won't message you again.", err: "This link is invalid or expired.", missing: "Invalid link." },
} as const;

export default function UnsubscribePage() {
  const { locale } = useLocale();
  const t = COPY[locale as keyof typeof COPY] ?? COPY.ru;
  const [contact, setContact] = useState("");
  const [token, setToken] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error" | "missing">("idle");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const c = p.get("c") || "";
    const tok = p.get("t") || "";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional on-mount sync (kick off a data load / read a browser-only value)
    setContact(c);
    setToken(tok);
    if (!c || !tok) setState("missing");
  }, []);

  async function unsubscribe() {
    setState("saving");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contact, token }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="pt-24 pb-20">
      <div className="container-custom max-w-md">
        <SectionHeading title={t.title} centered={false} className="mb-6" />
        {state === "done" ? (
          <p className="flex items-center gap-2 text-[var(--success,#16a34a)]"><CheckCircle className="w-5 h-5" /> {t.done}</p>
        ) : state === "missing" ? (
          <p className="text-red-400">{t.missing}</p>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">{t.body}</p>
            {state === "error" && <p className="text-sm text-red-400">{t.err}</p>}
            <Button onClick={unsubscribe} disabled={state === "saving" || !contact || !token} variant="outline">
              {state === "saving" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><BellOff className="w-4 h-4" /> {t.btn}</>}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
