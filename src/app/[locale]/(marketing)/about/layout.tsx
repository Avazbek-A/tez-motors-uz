import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "О компании Tez Motors",
  description:
    "Tez Motors — надёжный партнёр по импорту автомобилей из Китая в Узбекистан. Наша миссия, ценности и история компании.",
  openGraph: {
    title: "О компании — Tez Motors",
    description: "Узнайте больше о Tez Motors — импорт авто из Китая в Узбекистан.",
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
