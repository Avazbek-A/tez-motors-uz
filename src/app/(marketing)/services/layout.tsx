import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Наши услуги",
  description: "Полный спектр услуг по импорту автомобилей из Китая в Узбекистан: подбор, покупка, доставка, таможня, гарантия.",
};

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
