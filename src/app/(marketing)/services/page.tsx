import type { Metadata } from "next";
import ServicesContent from "./_content";

export const metadata: Metadata = {
  title: "Услуги — Tez Motors",
  description: "Полный цикл импорта из Китая: подбор, доставка, таможня, документы. Персональный менеджер на каждом этапе.",
};

export default function ServicesPage() {
  return <ServicesContent />;
}
