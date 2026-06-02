"use client";

import { useState } from "react";
import { Sparkles, Loader2, CheckCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CarCard } from "@/components/catalog/car-card";
import { Turnstile } from "@/components/shared/turnstile";
import { useLocale } from "@/i18n/locale-context";
import { track, FUNNEL } from "@/lib/analytics";
import type { Car } from "@/types/car";

/**
 * AI "Find my car" assistant widget.
 *
 * Grounding contract: the cars rendered here come straight from /api/assistant,
 * which selects them from the DB — the LLM only writes the accompanying prose.
 * So prices/models can never be hallucinated. If the LLM is unconfigured the
 * server returns a templated reply and the same real cars.
 */

const LABELS = {
  ru: {
    title: "Подбор авто с ИИ",
    subtitle: "Опишите, что ищете — например «семейный кроссовер до $30k» или «электромобиль с большим запасом хода»",
    placeholder: "Опишите желаемый автомобиль...",
    ask: "Подобрать",
    namePh: "Ваше имя (необязательно)",
    phonePh: "Телефон для связи (необязательно)",
    leadHint: "Оставьте имя и телефон — менеджер перезвонит с лучшим предложением",
    leadOk: "Заявка принята! Менеджер скоро свяжется с вами.",
    resultsTitle: "Подходящие варианты",
    error: "Не удалось обработать запрос. Попробуйте ещё раз.",
  },
  uz: {
    title: "AI yordamida avto tanlash",
    subtitle: "Nimani izlayotganingizni yozing — masalan «oilaviy krossover $30k gacha» yoki «katta zaxiraga ega elektromobil»",
    placeholder: "Qanday avtomobil kerakligini yozing...",
    ask: "Tanlash",
    namePh: "Ismingiz (ixtiyoriy)",
    phonePh: "Bog'lanish uchun telefon (ixtiyoriy)",
    leadHint: "Ism va telefon qoldiring — menejer eng yaxshi taklif bilan qo'ng'iroq qiladi",
    leadOk: "Ariza qabul qilindi! Menejer tez orada bog'lanadi.",
    resultsTitle: "Mos variantlar",
    error: "So'rovni qayta ishlab bo'lmadi. Yana urinib ko'ring.",
  },
  en: {
    title: "AI car finder",
    subtitle: "Describe what you need — e.g. \"family crossover under $30k\" or \"EV with long range\"",
    placeholder: "Describe the car you want...",
    ask: "Find",
    namePh: "Your name (optional)",
    phonePh: "Phone for callback (optional)",
    leadHint: "Leave your name and phone and a manager will call you with the best offer",
    leadOk: "Request received! A manager will contact you shortly.",
    resultsTitle: "Matching options",
    error: "Couldn't process the request. Please try again.",
  },
} as const;

export function FindMyCar() {
  const { locale } = useLocale();
  const t = LABELS[locale as keyof typeof LABELS] || LABELS.ru;

  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 2 || loading) return;
    track(FUNNEL.assistantAsk);
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          locale,
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          website: website || undefined,
          turnstile_token: turnstileToken ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(true);
        return;
      }
      setReply(data.reply || null);
      setCars(Array.isArray(data.cars) ? data.cars : []);
      setLeadCaptured(Boolean(data.lead_captured));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-neon-blue/20 rounded-2xl p-6 sm:p-8 text-white">
      <div className="flex items-start gap-4 mb-5">
        <div className="w-12 h-12 rounded-xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center shrink-0">
          <Sparkles className="w-6 h-6 text-neon-blue" />
        </div>
        <div>
          <h3 className="font-bold text-lg">{t.title}</h3>
          <p className="text-white/60 text-sm mt-1">{t.subtitle}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Honeypot: hidden from real users */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />
        <Turnstile onToken={setTurnstileToken} />

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t.placeholder}
            maxLength={500}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:ring-neon-blue focus:border-neon-blue flex-1"
          />
          <Button
            type="submit"
            disabled={loading || message.trim().length < 2}
            className="shrink-0 bg-neon-blue/20 border border-neon-blue/50 text-neon-blue hover:bg-neon-blue/30"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1" />{t.ask}</>}
          </Button>
        </div>

        <p className="text-white/40 text-xs">{t.leadHint}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.namePh}
            maxLength={100}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:ring-neon-blue focus:border-neon-blue"
          />
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.phonePh}
            maxLength={20}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:ring-neon-blue focus:border-neon-blue"
          />
        </div>
      </form>

      {error && (
        <p className="text-red-400 text-sm mt-4">{t.error}</p>
      )}

      {reply && (
        <div className="mt-5 bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-sm text-white/90 leading-relaxed whitespace-pre-line">{reply}</p>
        </div>
      )}

      {leadCaptured && (
        <div className="mt-3 flex items-center gap-2 bg-neon-green/10 border border-neon-green/20 rounded-xl p-3">
          <CheckCircle className="w-5 h-5 text-neon-green shrink-0" />
          <span className="text-neon-green font-medium text-sm">{t.leadOk}</span>
        </div>
      )}

      {cars.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-white/70 mb-3 uppercase tracking-wide">{t.resultsTitle}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cars.map((car) => (
              <CarCard key={car.id} car={car} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
