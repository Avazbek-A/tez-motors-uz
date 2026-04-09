"use client";

import { Package, Eye, Truck, ShieldCheck } from "lucide-react";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { TiltCard } from "@/components/effects";

const icons = [Package, Eye, Truck, ShieldCheck];

const neonAccents = [
  { color: "neon-blue", rgb: "0, 212, 255" },
  { color: "neon-purple", rgb: "139, 92, 246" },
  { color: "neon-green", rgb: "34, 255, 136" },
  { color: "neon-pink", rgb: "255, 45, 135" },
];

export function Features() {
  const { dictionary } = useLocale();
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-20 md:py-28 bg-[#0a0a0f] relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-neon-purple/3 rounded-full blur-[180px] pointer-events-none" />

      <div className="container-custom relative z-10">
        <SectionHeading
          title={dictionary.features.title}
          subtitle={dictionary.features.subtitle}
        />

        <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {dictionary.features.items.map((item: { title: string; description: string }, index: number) => {
            const Icon = icons[index];
            const accent = neonAccents[index % neonAccents.length];
            return (
              <TiltCard
                key={index}
                className={`rounded-2xl ${
                  isVisible ? "animate-fade-in-up" : "opacity-0"
                }`}
                maxTilt={8}
              >
                <div
                  className="group h-full bg-[#0d0d15]/80 backdrop-blur-sm rounded-2xl p-8 border border-white/[0.08] hover:border-neon-blue/20 transition-all duration-500"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Icon with neon glow */}
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300"
                    style={{
                      backgroundColor: `rgba(${accent.rgb}, 0.1)`,
                    }}
                  >
                    <Icon
                      className="w-7 h-7 transition-all duration-300"
                      style={{
                        color: `rgb(${accent.rgb})`,
                        filter: `drop-shadow(0 0 6px rgba(${accent.rgb}, 0.4))`,
                      }}
                    />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed">{item.description}</p>
                </div>
              </TiltCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}
