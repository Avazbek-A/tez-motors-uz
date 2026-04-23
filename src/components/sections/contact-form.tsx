"use client";

import { useState } from "react";
import { Send, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { ParticleBackground } from "@/components/effects";
import { Turnstile } from "@/components/shared/turnstile";

export function ContactForm() {
  const { dictionary } = useLocale();
  const { ref, isVisible } = useScrollReveal();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", phone: "", message: "" });
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          type: "general",
          source_page: "homepage",
          turnstile_token: turnstileToken ?? undefined,
        }),
      });
      if (res.ok) {
        setIsSuccess(true);
        setFormData({ name: "", phone: "", message: "" });
        setTimeout(() => setIsSuccess(false), 5000);
      } else {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error || dictionary.contact.error);
      }
    } catch {
      setFormError(dictionary.contact.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="py-20 md:py-28 bg-[#0a0a0f] relative overflow-hidden">
      <ParticleBackground particleCount={50} color="0, 212, 255" connectionDistance={100} />
      <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-neon-blue/5 to-transparent" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-neon-purple/5 rounded-full blur-3xl" />

      <div className="container-custom relative z-10">
        <SectionHeading
          title={dictionary.contact.title}
          subtitle={dictionary.contact.subtitle}
          light
        />

        <div ref={ref} className={`max-w-xl mx-auto ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}>
          {isSuccess ? (
            <div className="bg-black/60 backdrop-blur-md border border-neon-blue/10 rounded-2xl p-10 text-center">
              <CheckCircle className="w-16 h-16 text-neon-green mx-auto mb-4" />
              <p className="text-white text-lg font-semibold">{dictionary.contact.success}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-black/60 backdrop-blur-md border border-neon-blue/10 rounded-2xl p-8 space-y-5">
              <Input
                placeholder={dictionary.contact.name}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-neon-blue/50 focus:ring-neon-blue/30 focus:shadow-[0_0_15px_rgba(0,212,255,0.1)]"
              />
              <Input
                type="tel"
                placeholder={dictionary.contact.phone}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-neon-blue/50 focus:ring-neon-blue/30 focus:shadow-[0_0_15px_rgba(0,212,255,0.1)]"
              />
              <Textarea
                placeholder={dictionary.contact.message}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-neon-blue/50 focus:ring-neon-blue/30 focus:shadow-[0_0_15px_rgba(0,212,255,0.1)]"
                rows={4}
              />
              <Turnstile onToken={setTurnstileToken} />
              {formError && (
                <p className="text-sm text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />{formError}
                </p>
              )}
              <Button type="submit" size="lg" className="w-full bg-neon-blue hover:bg-neon-blue/80 text-black font-bold" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" />{dictionary.contact.submit}</>}
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
