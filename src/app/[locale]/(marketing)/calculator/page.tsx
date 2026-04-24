import type { Metadata } from "next";
import CalculatorContent from "./_content";

export const metadata: Metadata = {
  title: "Калькулятор стоимости импорта — Tez Motors",
  description: "Рассчитайте таможню, НДС, доставку, акциз. Бесплатный расчёт полной стоимости импорта автомобиля из Китая.",
};

export default function CalculatorPage() {
  return <CalculatorContent />;
}
