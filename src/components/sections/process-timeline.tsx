"use client";

import { FileText, Search, FileCheck, ShoppingCart, Ship, CarFront } from "lucide-react";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { PROCESS_STEPS } from "@/lib/constants";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

const iconMap: Record<string, React.ElementType> = {
  FileText, Search, FileCheck, ShoppingCart, Ship, CarFront,
};

export function ProcessTimeline() {
  const { locale, dictionary } = useLocale();
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-20 md:py-28 bg-navy relative overflow-hidden">
      <div className="absolute top-0 left-0 w-64 h-64 bg-lime/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-lime/3 rounded-full blur-3xl" />

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
                className={`glass rounded-2xl p-6 relative group hover:bg-white/12 transition-all duration-300 ${
                  isVisible ? "animate-fade-in-up" : "opacity-0"
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-lime/20 flex items-center justify-center group-hover:bg-lime/30 transition-colors">
                      <Icon className="w-6 h-6 text-lime" />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-lime/60 mb-1">
                      {String(step.step).padStart(2, "0")}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">
                      {step.title[locale as keyof typeof step.title]}
                    </h3>
                    <p className="text-sm text-white/50 leading-relaxed">
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
