"use client";

import { FileText, Search, FileCheck, ShoppingCart, Ship, CarFront } from "lucide-react";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { PROCESS_STEPS } from "@/lib/constants";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { ScanlineOverlay } from "@/components/effects";

const iconMap: Record<string, React.ElementType> = {
  FileText, Search, FileCheck, ShoppingCart, Ship, CarFront,
};

export function ProcessTimeline() {
  const { locale, dictionary } = useLocale();
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-20 md:py-28 bg-background relative overflow-hidden">
      <ScanlineOverlay intensity="light" />

      {/* Ambient washes */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-white/[0.025] rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl" />

      <div className="container-custom relative z-10">
        <SectionHeading
          title={dictionary.process.title}
          subtitle={dictionary.process.subtitle}
          light
        />

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PROCESS_STEPS.map((step, index) => {
            const Icon = iconMap[step.icon];
            return (
              <div
                key={step.step}
                className={`relative glass p-6 group
                  border border-border hover:border-white/20
                  hover:bg-white/[0.04] transition-all duration-300
                  ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Accent connector line on left */}
                <div className="absolute left-0 top-4 bottom-4 w-[2px] bg-gradient-to-b from-primary/60 via-primary/25 to-transparent" />

                <div className="flex items-start gap-4 pl-3">
                  <div className="shrink-0">
                    <div className="w-12 h-12 bg-primary/10 border border-white/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[var(--fg-3)] mb-1 font-mono tracking-[0.16em]">
                      {String(step.step).padStart(2, "0")}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">
                      {step.title[locale as keyof typeof step.title]}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description[locale as keyof typeof step.description]}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
