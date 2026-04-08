"use client";

import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { formatPrice } from "@/lib/utils";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

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
    <section className="py-20 md:py-28 bg-muted/50">
      <div className="container-custom">
        <SectionHeading
          title={dictionary.pricing.title}
          subtitle={dictionary.pricing.subtitle}
        />

        <div
          ref={ref}
          className={`max-w-3xl mx-auto ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
        >
          <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-lg">
            <div className="grid grid-cols-3 bg-navy text-white">
              <div className="p-4 text-sm font-medium" />
              <div className="p-4 text-center">
                <div className="text-sm font-bold text-lime">{dictionary.pricing.ourPrice}</div>
                <div className="text-xs text-white/50">Tez Motors</div>
              </div>
              <div className="p-4 text-center">
                <div className="text-sm font-bold text-white/70">{dictionary.pricing.competitorPrice}</div>
              </div>
            </div>

            {comparison.map((row, i) => (
              <div key={i} className="grid grid-cols-3 border-b border-border last:border-0">
                <div className="p-4 text-sm font-medium text-foreground">{row.label}</div>
                <div className="p-4 text-center text-sm font-semibold text-navy">
                  {formatPrice(row.ours)}
                </div>
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {formatPrice(row.theirs)}
                </div>
              </div>
            ))}

            <div className="grid grid-cols-3 bg-muted/50 border-t-2 border-navy">
              <div className="p-4 text-sm font-bold text-foreground">{dictionary.pricing.total}</div>
              <div className="p-4 text-center">
                <span className="text-xl font-bold text-lime-dark">{formatPrice(ourTotal)}</span>
              </div>
              <div className="p-4 text-center">
                <span className="text-xl font-bold text-muted-foreground line-through">{formatPrice(theirTotal)}</span>
              </div>
            </div>

            <div className="bg-lime/10 p-4 text-center">
              <span className="text-lg font-bold text-lime-dark">
                {dictionary.pricing.savings}: {formatPrice(savings)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
