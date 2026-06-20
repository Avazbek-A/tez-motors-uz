import type { Metadata } from "next";
import { makePageMetadata } from "@/lib/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return makePageMetadata("/calculator", {
    ru: {
      title: "Калькулятор растаможки авто в Узбекистане 2026",
      description:
        "Бесплатно рассчитайте растаможку авто в Узбекистане: пошлина, НДС 12%, утильсбор и сбор за оформление по объёму двигателя и возрасту. Ставки 2026, расчёт для электромобилей.",
    },
    uz: {
      title: "O'zbekistonda avto rastamojka kalkulyatori 2026",
      description:
        "O'zbekistonda avtomobil rastamojkasini bepul hisoblang: boj, 12% QQS, utilizatsiya yig'imi va rasmiylashtirish — dvigatel hajmi va yoshga qarab. 2026 tariflari, elektromobil uchun ham.",
    },
    en: {
      title: "Car customs (rastamozhka) calculator — Uzbekistan 2026",
      description:
        "Free customs-clearance calculator for Uzbekistan: duty, 12% VAT, recycling fee and clearance by engine size and age. 2026 rates, electric vehicles included.",
    },
  });
}

export default function CalculatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
