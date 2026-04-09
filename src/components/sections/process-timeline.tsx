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
    <section className="py-20 md:py-28 bg-[#0a0a0f] relative overflow-hidden">
      <ScanlineOverlay intensity="light" />

      {/* Neon ambient glows */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-neon-blue/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-neon-purple/5 rounded-full blur-3xl" />

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
                className={`relative glass rounded-2xl p-6 group
                  border border-neon-blue/10 hover:border-neon-blue/30
                  hover:bg-white/[0.04] transition-all duration-300
                  hover:shadow-[0_0_20px_rgba(0,212,255,0.08)]
                  ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Neon connector line on left */}
                <div className="absolute left-0 top-4 bottom-4 w-[2px] rounded-full bg-gradient-to-b from-neon-blue/60 via-neon-purple/40 to-transparent" />

                <div className="flex items-start gap-4 pl-3">
                  <div className="shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center group-hover:bg-neon-blue/20 transition-colors animate-glow-breathe">
                      <Icon className="w-6 h-6 text-neon-blue" />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-neon-purple/70 mb-1 font-mono tracking-wider">
                      {String(step.step).padStart(2, "0")}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">
                      {step.title[locale as keyof typeof step.title]}
                    </h3>
                    <p className="text-sm text-white/60 leading-relaxed">
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
