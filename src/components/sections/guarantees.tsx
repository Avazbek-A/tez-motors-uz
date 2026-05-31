"use client";

import { Scale, Shield, Wrench } from "lucide-react";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { NeonBorder } from "@/components/effects";

const icons = [Scale, Shield, Wrench];
const neonColors: Array<"blue" | "purple" | "green"> = ["blue", "purple", "green"];

export function Guarantees() {
  const { dictionary } = useLocale();
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-20 md:py-28 bg-background relative overflow-hidden">
      {/* Ambient washes */}
      <div className="absolute top-1/2 left-0 w-72 h-72 bg-white/[0.025] rounded-full blur-3xl -translate-y-1/2" />
      <div className="absolute top-1/2 right-0 w-72 h-72 bg-white/[0.025] rounded-full blur-3xl -translate-y-1/2" />

      <div className="container-custom relative z-10">
        <SectionHeading
          title={dictionary.guarantees.title}
          subtitle={dictionary.guarantees.subtitle}
          light
        />

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {dictionary.guarantees.items.map((item: { title: string; description: string }, index: number) => {
            const Icon = icons[index];
            const color = neonColors[index % neonColors.length];
            return (
              <NeonBorder key={index} color={color} animated>
                <div
                  className={`bg-card p-8 text-white group
                    hover:bg-muted transition-all duration-300 hover:-translate-y-1
                    ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Icon — metallic shimmer sweep on hover */}
                  <div className="relative w-14 h-14 bg-primary/10 border border-white/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors overflow-hidden">
                    <Icon className="w-7 h-7 text-primary relative z-10" />
                    {/* Metallic shimmer sweep */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{
                        background: "linear-gradient(105deg, transparent 40%, rgba(246,245,242,0.18) 48%, rgba(246,245,242,0.10) 54%, transparent 60%)",
                        backgroundSize: "200% 100%",
                        animation: "shimmer 2s infinite linear",
                      }}
                    />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
                </div>
              </NeonBorder>
            );
          })}
        </div>
      </div>
    </section>
  );
}
