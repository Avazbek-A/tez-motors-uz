import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Сравнение автомобилей",
  description: "Сравните характеристики и цены китайских автомобилей. Выберите лучший вариант для себя.",
  openGraph: {
    title: "Сравнение авто — Tez Motors",
    description: "Сравните характеристики и цены китайских автомобилей.",
  },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
