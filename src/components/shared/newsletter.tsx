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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source_page: window.location.pathname }),
      });
      if (res.ok) {
        setSuccess(true);
        setEmail("");
        setTimeout(() => setSuccess(false), 4000);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#0d0d15] border border-neon-blue/20 rounded-2xl p-8 text-white">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center shrink-0">
          <Mail className="w-6 h-6 text-neon-blue" />
        </div>
        <div>
          <h3 className="font-bold text-lg">{t.title}</h3>
          <p className="text-white/60 text-sm mt-1">{t.subtitle}</p>
        </div>
      </div>

      {success ? (
        <div className="flex items-center gap-2 bg-neon-green/10 border border-neon-green/20 rounded-xl p-4">
          <CheckCircle className="w-5 h-5 text-neon-green" />
          <span className="text-neon-green font-medium text-sm">{t.success}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.placeholder}
            required
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:ring-neon-blue focus:border-neon-blue flex-1"
          />
          <Button type="submit" size="default" disabled={loading} className="shrink-0 bg-neon-blue/20 border border-neon-blue/50 text-neon-blue hover:bg-neon-blue/30 hover:shadow-[0_0_15px_rgba(0,212,255,0.3)]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.button}
          </Button>
        </form>
      )}
    </div>
  );
}
