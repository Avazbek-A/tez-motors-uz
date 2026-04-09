"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-context";

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const { locale } = useLocale();

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setIsVisible(false);
  };

  const decline = () => {
    localStorage.setItem("cookie-consent", "declined");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const text = {
    ru: {
      message: "Мы используем файлы cookie для улучшения работы сайта.",
      accept: "Принять",
      decline: "Отклонить",
    },
    uz: {
      message: "Biz sayt ishini yaxshilash uchun cookie fayllaridan foydalanamiz.",
      accept: "Qabul qilish",
      decline: "Rad etish",
    },
    en: {
      message: "We use cookies to improve your browsing experience.",
      accept: "Accept",
      decline: "Decline",
    },
  };

  const t = text[locale as keyof typeof text] || text.ru;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-fade-in-up">
      <div className="container-custom">
        <div className="glass border border-neon-blue/20 rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_30px_rgba(0,212,255,0.1)]">
          <p className="text-sm text-white/70 flex-1">{t.message}</p>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={accept} className="bg-neon-blue/20 border border-neon-blue/50 text-neon-blue hover:bg-neon-blue/30 hover:shadow-[0_0_15px_rgba(0,212,255,0.3)]">
              {t.accept}
            </Button>
            <Button size="sm" variant="ghost" onClick={decline} className="text-white/60 hover:text-white hover:bg-white/5">
              {t.decline}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
