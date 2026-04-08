import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Каталог автомобилей из Китая",
  description:
    "Каталог китайских автомобилей с ценами. BYD, Chery, Haval, Geely, Changan, JETOUR, Zeekr и другие бренды. Доставка в Узбекистан.",
  openGraph: {
    title: "Каталог автомобилей — Tez Motors",
    description: "Выберите автомобиль из Китая по выгодной цене с доставкой в Узбекистан.",
  },
};

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
