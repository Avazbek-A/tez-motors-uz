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
    <section className="py-20 md:py-28 bg-background relative overflow-hidden">
      <GridBackground />

      {/* Ambient washes */}
      <div className="absolute top-0 right-1/4 w-64 h-64 bg-white/[0.02] rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-white/[0.025] rounded-full blur-3xl" />

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
          <div className="bg-card border border-border overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-3 bg-card border-b border-border">
              <div className="p-4 text-sm font-medium" />
              <div className="p-4 text-center bg-neon-green/[0.05] border-x border-neon-green/15">
                <div className="text-sm font-bold text-neon-green">{dictionary.pricing.ourPrice}</div>
                <div className="text-xs text-[var(--fg-3)] font-mono uppercase tracking-[0.16em]">Tez Motors</div>
              </div>
              <div className="p-4 text-center">
                <div className="text-sm font-bold text-muted-foreground">{dictionary.pricing.competitorPrice}</div>
              </div>
            </div>

            {/* Data rows */}
            {comparison.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-3 border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02] transition-colors"
              >
                <div className="p-4 text-sm font-medium text-muted-foreground">{row.label}</div>
                <div className="p-4 text-center text-sm font-semibold font-mono text-neon-green bg-neon-green/[0.05] border-x border-neon-green/15">
                  {formatPrice(row.ours)}
                </div>
                <div className="p-4 text-center text-sm font-mono text-white/30">
                  {formatPrice(row.theirs)}
                </div>
              </div>
            ))}

            {/* Total row */}
            <div className="grid grid-cols-3 border-t border-border bg-muted">
              <div className="p-4 text-sm font-bold text-white/70">{dictionary.pricing.total}</div>
              <div className="p-4 text-center bg-neon-green/[0.08] border-x border-neon-green/15">
                <span className="text-xl font-bold font-mono text-neon-green">{formatPrice(ourTotal)}</span>
              </div>
              <div className="p-4 text-center">
                <span className="text-xl font-bold font-mono text-white/30 line-through">{formatPrice(theirTotal)}</span>
              </div>
            </div>

            {/* Savings banner */}
            <div className="bg-neon-green/[0.10] border-t border-neon-green/25 p-4 text-center">
              <span className="text-lg font-bold font-mono text-neon-green">
                {dictionary.pricing.savings}: {formatPrice(savings)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
