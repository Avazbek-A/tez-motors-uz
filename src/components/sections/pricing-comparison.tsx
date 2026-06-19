"use client";

import Link from "next/link";
import { Scale, Landmark, FileText, BadgeCheck, Headset, Lock } from "lucide-react";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { GridBackground } from "@/components/effects";

// Honest transparency block (replaced the old price-vs-middlemen table). Tez's real
// edge over a competent middleman isn't a per-car price delta — it's that we SHOW the
// parts middlemen hide (customs, FX, the invoice, fees, spec/warranty). Each point is a
// thing we can prove; the customer infers the contrast. No fabricated savings number.
const ICONS = [Scale, Landmark, FileText, BadgeCheck, Headset, Lock];

export function PricingComparison() {
  const { locale, dictionary } = useLocale();
  const { ref, isVisible } = useScrollReveal();
  const points = dictionary.pricing.points;

  return (
    <section className="py-20 md:py-28 bg-background relative overflow-hidden">
      <GridBackground />

      {/* Ambient washes */}
      <div className="absolute top-0 right-1/4 w-64 h-64 bg-white/[0.02] rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-white/[0.025] rounded-full blur-3xl" />

      <div className="container-custom relative z-10">
        <SectionHeading title={dictionary.pricing.title} subtitle={dictionary.pricing.subtitle} light />

        <div
          ref={ref}
          className={`max-w-5xl mx-auto ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {points.map((pt, i) => {
              const Icon = ICONS[i % ICONS.length];
              return (
                <div
                  key={i}
                  className="bg-card border border-border rounded-xl p-5 hover:border-neon-green/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-neon-green/[0.08] border border-neon-green/15 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-neon-green" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-1.5">{pt.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{pt.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Bridge to the real customs engine — get your exact number. */}
          <div className="mt-8 text-center">
            <Link
              href={localizedPath(locale, "/calculator")}
              className="inline-flex items-center gap-1 text-sm font-semibold text-neon-green hover:opacity-80 transition-opacity underline-offset-4 hover:underline"
            >
              {dictionary.pricing.calculateExact}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
