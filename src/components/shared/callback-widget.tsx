"use client";

import { useState } from "react";
import { Phone, X, Send, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/i18n/locale-context";
import { cn } from "@/lib/utils";

export function CallbackWidget() {
  const { locale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const labels = {
    ru: { title: "Перезвоните мне", name: "Ваше имя", phone: "Телефон", submit: "Жду звонка", success: "Мы перезвоним!", error: "Ошибка отправки. Попробуйте ещё раз." },
    uz: { title: "Menga qo'ng'iroq qiling", name: "Ismingiz", phone: "Telefon", submit: "Qo'ng'iroq kutaman", success: "Qo'ng'iroq qilamiz!", error: "Yuborishda xatolik. Qayta urinib ko'ring." },
    en: { title: "Call me back", name: "Your name", phone: "Phone", submit: "Request callback", success: "We'll call you!", error: "Failed to send. Please try again." },
  };

  const t = labels[locale as keyof typeof labels] || labels.ru;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t.error);
        return;
      }
      setIsSuccess(true);
      setName("");
      setPhone("");
      setTimeout(() => {
        setIsSuccess(false);
        setIsOpen(false);
      }, 3000);
    } catch {
      setError(t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Trigger button - positioned above WhatsApp button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-24 right-6 z-40 w-12 h-12 bg-[#0d0d15] border border-neon-purple/50 hover:border-neon-purple text-neon-purple rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] transition-all duration-300 hover:scale-110",
          isOpen && "hidden"
        )}
        aria-label="Request callback"
      >
        <Phone className="w-5 h-5" />
      </button>

      {/* Popup */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 animate-fade-in-up">
          <div className="bg-[#0d0d15] rounded-2xl shadow-[0_0_30px_rgba(0,212,255,0.1)] border border-neon-blue/20 overflow-hidden">
            {/* Header */}
            <div className="bg-neon-blue/10 border-b border-neon-blue/20 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-neon-blue" />
                <span className="font-semibold text-sm">{t.title}</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              {isSuccess ? (
                <div className="text-center py-4">
                  <CheckCircle className="w-10 h-10 text-neon-green mx-auto mb-2" />
                  <p className="font-semibold text-sm text-white">{t.success}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <Input
                    placeholder={t.name}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-10 text-sm bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-neon-blue focus:ring-neon-blue/30"
                  />
                  <Input
                    type="tel"
                    placeholder={t.phone}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="h-10 text-sm bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-neon-blue focus:ring-neon-blue/30"
                  />
                  {error && (
                    <p className="text-xs text-red-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
                    </p>
                  )}
                  <Button type="submit" size="sm" className="w-full bg-neon-blue/20 border border-neon-blue/50 text-neon-blue hover:bg-neon-blue/30 hover:shadow-[0_0_15px_rgba(0,212,255,0.3)]" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" />{t.submit}</>}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
