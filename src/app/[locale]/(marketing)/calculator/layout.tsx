import type { Metadata } from "next";
import { makePageMetadata } from "@/lib/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return makePageMetadata("/calculator", {
    ru: {
      title: "Калькулятор стоимости импорта авто из Китая",
      description:
        "Рассчитайте таможню, НДС, акциз, доставку. Бесплатный расчёт полной стоимости импорта авто из Китая в Узбекистан.",
    },
    uz: {
      title: "Xitoydan avto import qiymati kalkulyatori",
      description:
        "Bojxona, QQS, aksiz, yetkazib berish — Xitoydan O'zbekistonga avtomobil importining to'liq qiymatini bepul hisoblang.",
    },
    en: {
      title: "China car import cost calculator — Uzbekistan",
      description:
        "Calculate customs, VAT, excise, and shipping. Free full-cost estimator for importing a car from China to Uzbekistan.",
    },
  });
}

export default function CalculatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
