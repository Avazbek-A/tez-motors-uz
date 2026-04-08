"use client";

import { Package, Eye, Truck, ShieldCheck } from "lucide-react";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

const icons = [Package, Eye, Truck, ShieldCheck];

export function Features() {
  const { dictionary } = useLocale();
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-20 md:py-28 bg-muted/50">
      <div className="container-custom">
        <SectionHeading
          title={dictionary.features.title}
          subtitle={dictionary.features.subtitle}
        />

        <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {dictionary.features.items.map((item: { title: string; description: string }, index: number) => {
            const Icon = icons[index];
            return (
              <div
                key={index}
                className={`group bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1 border border-border ${
                  isVisible ? "animate-fade-in-up" : "opacity-0"
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-14 h-14 rounded-2xl bg-lime/15 flex items-center justify-center mb-6 group-hover:bg-lime/25 transition-colors">
                  <Icon className="w-7 h-7 text-lime-dark" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-3">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
