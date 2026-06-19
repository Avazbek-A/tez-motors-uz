"use client";

import { TradeInForm, TRADE_IN_COPY } from "@/components/trade-in/trade-in-form";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";

export default function SellYourCarPage() {
  const { locale } = useLocale();
  const t = TRADE_IN_COPY[locale];
  return (
    <div className="pt-24 pb-16">
      <div className="container-custom max-w-3xl">
        <SectionHeading as="h1" title={t.title} subtitle={t.subtitle} />
        <TradeInForm sourcePage="sell-your-car" />
      </div>
    </div>
  );
}
