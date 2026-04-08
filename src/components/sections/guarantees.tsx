"use client";

import { Scale, Shield, Wrench } from "lucide-react";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

const icons = [Scale, Shield, Wrench];

export function Guarantees() {
  const { dictionary } = useLocale();
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-20 md:py-28">
      <div className="container-custom">
        <SectionHeading
          title={dictionary.guarantees.title}
          subtitle={dictionary.guarantees.subtitle}
        />

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {dictionary.guarantees.items.map((item: { title: string; description: string }, index: number) => {
            const Icon = icons[index];
            return (
              <div
                key={index}
                className={`bg-gradient-to-br from-navy to-navy-light rounded-2xl p-8 text-white group hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 ${
                  isVisible ? "animate-fade-in-up" : "opacity-0"
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-14 h-14 rounded-2xl bg-lime/15 flex items-center justify-center mb-6 group-hover:bg-lime/25 transition-colors">
                  <Icon className="w-7 h-7 text-lime" />
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
