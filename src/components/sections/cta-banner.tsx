"use client";

import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-context";
import { SITE_CONFIG } from "@/lib/constants";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

export function CtaBanner() {
  const { dictionary } = useLocale();
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-16 md:py-20">
      <div className="container-custom">
        <div
          ref={ref}
          className={`bg-gradient-to-r from-lime to-lime-dark rounded-3xl p-10 md:p-16 text-center ${
            isVisible ? "animate-fade-in-up" : "opacity-0"
          }`}
        >
          <h2 className="text-2xl md:text-4xl font-bold text-navy mb-4">
            {dictionary.common.getConsultation}
          </h2>
          <p className="text-navy/70 text-lg mb-8 max-w-xl mx-auto">
            {dictionary.contact.subtitle}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="xl" variant="secondary" asChild>
              <Link href="/contacts">
                {dictionary.contact.submit}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button size="xl" variant="outline" className="border-navy/30 text-navy hover:bg-navy hover:text-white" asChild>
              <a href={`tel:${SITE_CONFIG.phoneRaw}`}>
                <Phone className="w-5 h-5" />
                {dictionary.common.callUs}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
