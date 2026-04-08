"use client";

import { useState } from "react";
import { Mail, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/i18n/locale-context";

export function Newsletter() {
  const { locale } = useLocale();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const labels = {
    ru: { title: "Подпишитесь на новинки", subtitle: "Получайте уведомления о новых автомобилях и специальных предложениях", placeholder: "Ваш email", button: "Подписаться", success: "Вы подписаны!" },
    uz: { title: "Yangiliklarga obuna bo'ling", subtitle: "Yangi avtomobillar va maxsus takliflar haqida xabar oling", placeholder: "Email manzilingiz", button: "Obuna bo'lish", success: "Obuna bo'ldingiz!" },
    en: { title: "Subscribe to updates", subtitle: "Get notifications about new cars and special offers", placeholder: "Your email", button: "Subscribe", success: "Subscribed!" },
  };
  const t = labels[locale as keyof typeof labels] || labels.ru;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setSuccess(true);
      setEmail("");
      setLoading(false);
      setTimeout(() => setSuccess(false), 3000);
    }, 500);
  };

  return (
    <div className="bg-gradient-to-r from-navy to-navy-light rounded-2xl p-8 text-white">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-lime/20 flex items-center justify-center shrink-0">
          <Mail className="w-6 h-6 text-lime" />
        </div>
        <div>
          <h3 className="font-bold text-lg">{t.title}</h3>
          <p className="text-white/50 text-sm mt-1">{t.subtitle}</p>
        </div>
      </div>

      {success ? (
        <div className="flex items-center gap-2 bg-lime/20 rounded-xl p-4">
          <CheckCircle className="w-5 h-5 text-lime" />
          <span className="text-lime font-medium text-sm">{t.success}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.placeholder}
            required
            className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:ring-lime flex-1"
          />
          <Button type="submit" size="default" disabled={loading} className="shrink-0">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.button}
          </Button>
        </form>
      )}
    </div>
  );
}
