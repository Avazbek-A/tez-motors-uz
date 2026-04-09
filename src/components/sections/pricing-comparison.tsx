"use client";

import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { formatPrice } from "@/lib/utils";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { GridBackground } from "@/components/effects";

export function PricingComparison() {
  const { dictionary } = useLocale();
  const { ref, isVisible } = useScrollReveal();

  const comparison = [
    { label: dictionary.pricing.carPrice, ours: 25000, theirs: 25000 },
    { label: dictionary.pricing.customs, ours: 5000, theirs: 5000 },
    { label: dictionary.pricing.delivery, ours: 2000, theirs: 3500 },
    { label: dictionary.pricing.service, ours: 1500, theirs: 4000 },
  ];

  const ourTotal = comparison.reduce((s, r) => s + r.ours, 0);
  const theirTotal = comparison.reduce((s, r) => s + r.theirs, 0);
  const savings = theirTotal - ourTotal;

  return (
    <section className="py-20 md:py-28 bg-[#0a0a0f] relative overflow-hidden">
      <GridBackground />

      {/* Ambient neon glows */}
      <div className="absolute top-0 right-1/4 w-64 h-64 bg-neon-green/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-neon-blue/5 rounded-full blur-3xl" />

      <div className="container-custom relative z-10">
        <SectionHeading
          title={dictionary.pricing.title}
          subtitle={dictionary.pricing.subtitle}
          light
        />

        <div
          ref={ref}
          className={`max-w-3xl mx-auto ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
        >
          <div className="bg-[#0d0d15] rounded-2xl border border-neon-blue/15 overflow-hidden shadow-[0_0_30px_rgba(0,212,255,0.06)]">
            {/* Header row */}
            <div className="grid grid-cols-3 bg-[#0d0d15] border-b border-neon-blue/10">
              <div className="p-4 text-sm font-medium" />
              <div className="p-4 text-center bg-neon-green/[0.04] border-x border-neon-green/10">
                <div className="text-sm font-bold text-neon-green">{dictionary.pricing.ourPrice}</div>
                <div className="text-xs text-white/30 font-mono">Tez Motors</div>
              </div>
              <div className="p-4 text-center">
                <div className="text-sm font-bold text-white/60">{dictionary.pricing.competitorPrice}</div>
              </div>
            </div>

            {/* Data rows */}
            {comparison.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
              >
                <div className="p-4 text-sm font-medium text-white/60">{row.label}</div>
                <div className="p-4 text-center text-sm font-semibold text-neon-green bg-neon-green/[0.04] border-x border-neon-green/10">
                  {formatPrice(row.ours)}
                </div>
                <div className="p-4 text-center text-sm text-white/30">
                  {formatPrice(row.theirs)}
                </div>
              </div>
            ))}

            {/* Total row */}
            <div className="grid grid-cols-3 border-t border-neon-blue/15 bg-[#0a0a12]">
              <div className="p-4 text-sm font-bold text-white/70">{dictionary.pricing.total}</div>
              <div className="p-4 text-center bg-neon-green/[0.06] border-x border-neon-green/10">
                <span className="text-xl font-bold text-neon-green">{formatPrice(ourTotal)}</span>
              </div>
              <div className="p-4 text-center">
                <span className="text-xl font-bold text-white/30 line-through">{formatPrice(theirTotal)}</span>
              </div>
            </div>

            {/* Savings banner */}
            <div className="bg-neon-green/[0.08] border-t border-neon-green/20 p-4 text-center">
              <span className="text-lg font-bold text-neon-green neon-glow">
                {dictionary.pricing.savings}: {formatPrice(savings)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
