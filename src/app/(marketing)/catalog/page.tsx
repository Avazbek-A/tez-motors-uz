import type { Metadata } from "next";
import CatalogContentWrapper from "./_content";

export const metadata: Metadata = {
  title: "Каталог авто из Китая — Tez Motors",
  description: "BYD, Haval, Chery, Geely и другие бренды. Актуальные цены и характеристики. Импорт автомобилей из Китая в Узбекистан.",
};

export default function CatalogPage() {
  return <CatalogContentWrapper />;
}
