"use client";

import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";
import { useSiteSettings } from "@/lib/site-settings-context";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { ScanlineOverlay } from "@/components/effects";

export function CtaBanner() {
  const { locale, dictionary } = useLocale();
  const settings = useSiteSettings();
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-16 md:py-20 bg-background">
      <div className="container-custom">
        <div
          ref={ref}
          className={`relative bg-gradient-to-r from-primary/12 via-primary/[0.06] to-primary/12 border border-border rounded-none p-10 md:p-16 text-center overflow-hidden ${
            isVisible ? "animate-fade-in-up" : "opacity-0"
          }`}
        >
          <ScanlineOverlay intensity="light" />
          <div className="absolute inset-0 bg-background/60" />

          <div className="relative z-20">
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
              {dictionary.common.getConsultation}
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              {dictionary.contact.subtitle}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="xl" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold" asChild>
                <Link href={localizedPath(locale, "/contacts")}>
                  {dictionary.contact.submit}
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" className="border-border text-foreground hover:bg-white/5 hover:border-white/20" asChild>
                <a href={`tel:${settings.phoneRaw}`}>
                  <Phone className="w-5 h-5" />
                  {dictionary.common.callUs}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
