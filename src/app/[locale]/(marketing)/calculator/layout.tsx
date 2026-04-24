import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Калькулятор стоимости импорта авто",
  description:
    "Рассчитайте стоимость импорта автомобиля из Китая в Узбекистан. Таможенные пошлины, акциз, НДС, доставка — всё включено.",
  openGraph: {
    title: "Калькулятор стоимости — Tez Motors",
    description: "Рассчитайте полную стоимость импорта авто из Китая в Узбекистан.",
  },
};

export default function CalculatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
