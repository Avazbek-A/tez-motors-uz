"use client";

import { useState } from "react";
import { Send, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

export function ContactForm() {
  const { dictionary } = useLocale();
  const { ref, isVisible } = useScrollReveal();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({ name: "", phone: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, type: "general", source_page: "homepage" }),
      });
      if (res.ok) {
        setIsSuccess(true);
        setFormData({ name: "", phone: "", message: "" });
        setTimeout(() => setIsSuccess(false), 5000);
      }
    } catch { /* silent */ } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="py-20 md:py-28 bg-gradient-to-br from-navy via-navy to-navy-light relative overflow-hidden">
      <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-lime/5 to-transparent" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-lime/5 rounded-full blur-3xl" />

      <div className="container-custom relative z-10">
        <SectionHeading
          title={dictionary.contact.title}
          subtitle={dictionary.contact.subtitle}
          light
        />

        <div ref={ref} className={`max-w-xl mx-auto ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}>
          {isSuccess ? (
            <div className="glass rounded-2xl p-10 text-center">
              <CheckCircle className="w-16 h-16 text-lime mx-auto mb-4" />
              <p className="text-white text-lg font-semibold">{dictionary.contact.success}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 space-y-5">
              <Input
                placeholder={dictionary.contact.name}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:ring-lime"
              />
              <Input
                type="tel"
                placeholder={dictionary.contact.phone}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:ring-lime"
              />
              <Textarea
                placeholder={dictionary.contact.message}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:ring-lime"
                rows={4}
              />
              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" />{dictionary.contact.submit}</>}
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
