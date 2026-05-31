"use client";

import { Package, Eye, Truck, ShieldCheck } from "lucide-react";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { TiltCard } from "@/components/effects";

const icons = [Package, Eye, Truck, ShieldCheck];

export function Features() {
  const { dictionary } = useLocale();
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-20 md:py-28 bg-background relative overflow-hidden">
      {/* Subtle background wash */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-white/[0.02] rounded-full blur-[180px] pointer-events-none" />

      <div className="container-custom relative z-10">
        <SectionHeading
          title={dictionary.features.title}
          subtitle={dictionary.features.subtitle}
        />

        <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {dictionary.features.items.map((item: { title: string; description: string }, index: number) => {
            const Icon = icons[index];
            return (
              <TiltCard
                key={index}
                className={`${
                  isVisible ? "animate-fade-in-up" : "opacity-0"
                }`}
                maxTilt={8}
              >
                <div
                  className="group h-full bg-card p-8 border border-border hover:border-white/20 transition-all duration-500"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Icon tile — platinum accent */}
                  <div className="w-14 h-14 flex items-center justify-center mb-6 bg-primary/10 border border-white/10 transition-all duration-300">
                    <Icon className="w-7 h-7 text-primary transition-all duration-300" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </TiltCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}
