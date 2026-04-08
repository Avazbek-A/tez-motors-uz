"use client";

import { useState } from "react";
import { Phone, X, Send, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/i18n/locale-context";
import { cn } from "@/lib/utils";

export function CallbackWidget() {
  const { locale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const labels = {
    ru: { title: "Перезвоните мне", name: "Ваше имя", phone: "Телефон", submit: "Жду звонка", success: "Мы перезвоним!" },
    uz: { title: "Menga qo'ng'iroq qiling", name: "Ismingiz", phone: "Telefon", submit: "Qo'ng'iroq kutaman", success: "Qo'ng'iroq qilamiz!" },
    en: { title: "Call me back", name: "Your name", phone: "Phone", submit: "Request callback", success: "We'll call you!" },
  };

  const t = labels[locale as keyof typeof labels] || labels.ru;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await fetch("/api/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      setIsSuccess(true);
      setName("");
      setPhone("");
      setTimeout(() => {
        setIsSuccess(false);
        setIsOpen(false);
      }, 3000);
    } catch { /* silent */ } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Trigger button - positioned above WhatsApp button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-24 right-6 z-40 w-12 h-12 bg-navy hover:bg-navy-light text-white rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110",
          isOpen && "hidden"
        )}
        aria-label="Request callback"
      >
        <Phone className="w-5 h-5" />
      </button>

      {/* Popup */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 animate-fade-in-up">
          <div className="bg-white rounded-2xl shadow-2xl border border-border overflow-hidden">
            {/* Header */}
            <div className="bg-navy text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-lime" />
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
                  <CheckCircle className="w-10 h-10 text-lime-dark mx-auto mb-2" />
                  <p className="font-semibold text-sm">{t.success}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <Input
                    placeholder={t.name}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-10 text-sm"
                  />
                  <Input
                    type="tel"
                    placeholder={t.phone}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="h-10 text-sm"
                  />
                  <Button type="submit" size="sm" className="w-full" disabled={isSubmitting}>
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
