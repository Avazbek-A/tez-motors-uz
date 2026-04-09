"use client";

import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-context";
import { SITE_CONFIG } from "@/lib/constants";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { ScanlineOverlay } from "@/components/effects";

export function CtaBanner() {
  const { dictionary } = useLocale();
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-16 md:py-20 bg-[#0a0a0f]">
      <div className="container-custom">
        <div
          ref={ref}
          className={`relative bg-gradient-to-r from-neon-blue/20 via-neon-purple/20 to-neon-blue/20 border border-neon-blue/20 rounded-3xl p-10 md:p-16 text-center overflow-hidden ${
            isVisible ? "animate-fade-in-up" : "opacity-0"
          }`}
        >
          <ScanlineOverlay intensity="light" />
          <div className="absolute inset-0 bg-[#0a0a0f]/60" />

          <div className="relative z-20">
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
              {dictionary.common.getConsultation}
            </h2>
            <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">
              {dictionary.contact.subtitle}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="xl" className="bg-neon-blue hover:bg-neon-blue/80 text-black font-bold" asChild>
                <Link href="/contacts">
                  {dictionary.contact.submit}
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" className="border-neon-blue/30 text-neon-blue hover:bg-neon-blue/10 hover:border-neon-blue/50" asChild>
                <a href={`tel:${SITE_CONFIG.phoneRaw}`}>
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
