import type { Metadata } from "next";
import AboutContent from "./_content";

export const metadata: Metadata = {
  title: "О нас — Tez Motors",
  description: "Tez Motors — импортёр автомобилей из Китая в Узбекистан с 2024 года. Прозрачность, надёжность, скорость.",
};

export default function AboutPage() {
  return <AboutContent />;
}
