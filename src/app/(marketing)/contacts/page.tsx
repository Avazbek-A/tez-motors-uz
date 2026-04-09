"use client";

import { useState } from "react";

import { Phone, Mail, MapPin, Clock, Send, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { SITE_CONFIG } from "@/lib/constants";

export default function ContactsPage() {
  const { dictionary } = useLocale();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type: "general", source_page: "contacts" }),
      });
      if (res.ok) {
        setIsSuccess(true);
        setForm({ name: "", phone: "", email: "", message: "" });
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

  const contactInfo = [
    { icon: Phone, label: SITE_CONFIG.phone, href: `tel:${SITE_CONFIG.phoneRaw}` },
    { icon: Mail, label: SITE_CONFIG.email, href: `mailto:${SITE_CONFIG.email}` },
    { icon: MapPin, label: SITE_CONFIG.address, href: undefined },
    { icon: Clock, label: dictionary.footer.workingHours, href: undefined },
  ];

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading
          title={dictionary.footer.contacts}
          subtitle={dictionary.contact.subtitle}
        />

        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Contact Info */}
          <div
            className="animate-fade-in-up space-y-6"
          >
            <div className="bg-[#0d0d15] rounded-2xl border border-white/10 p-8 space-y-6">
              {contactInfo.map((item, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-neon-blue/15 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-neon-blue" />
                  </div>
                  <div>
                    {item.href ? (
                      <a href={item.href} className="text-white font-medium hover:text-neon-blue transition-colors">
                        {item.label}
                      </a>
                    ) : (
                      <p className="text-white font-medium">{item.label}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Messenger buttons */}
            <div className="grid grid-cols-2 gap-4">
              <a
                href={SITE_CONFIG.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600 text-white rounded-2xl p-4 font-semibold transition-colors"
              >
                WhatsApp
              </a>
              <a
                href={SITE_CONFIG.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl p-4 font-semibold transition-colors"
              >
                Telegram
              </a>
            </div>

            {/* Map placeholder */}
            <div className="bg-[#0a0a0f] rounded-2xl h-64 flex items-center justify-center border border-white/10">
              <div className="text-center text-white/60">
                <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Map will be displayed here</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div
            className="animate-fade-in-up"
            style={{ animationDelay: "100ms" }}
          >
            {isSuccess ? (
              <div className="bg-[#0d0d15] rounded-2xl border border-white/10 p-12 text-center">
                <CheckCircle className="w-16 h-16 text-neon-blue mx-auto mb-4" />
                <p className="text-lg font-semibold">{dictionary.contact.success}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-[#0d0d15] rounded-2xl border border-white/10 p-8 space-y-5">
                <h3 className="text-xl font-bold">{dictionary.contact.title}</h3>
                <Input
                  placeholder={dictionary.contact.name}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <Input
                  type="tel"
                  placeholder={dictionary.contact.phone}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                />
                <Input
                  type="email"
                  placeholder={dictionary.contact.email}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <Textarea
                  placeholder={dictionary.contact.message}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={5}
                />
                {formError && (
                  <p className="text-sm text-red-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />{formError}
                  </p>
                )}
                <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      {dictionary.contact.submit}
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
