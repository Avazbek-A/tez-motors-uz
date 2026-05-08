import type { Metadata } from "next";
import { makePageMetadata } from "@/lib/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return makePageMetadata("/compare", {
    ru: {
      title: "Сравнение автомобилей — Tez Motors",
      description:
        "Сравните характеристики и цены китайских авто: BYD, Haval, Chery, Geely и другие бренды. Выберите лучший вариант.",
    },
    uz: {
      title: "Avtomobillarni taqqoslash — Tez Motors",
      description:
        "Xitoy avtomobillarining xususiyatlari va narxlarini taqqoslang: BYD, Haval, Chery, Geely va boshqa brendlar.",
    },
    en: {
      title: "Compare cars — Tez Motors",
      description:
        "Compare specs and prices for Chinese cars: BYD, Haval, Chery, Geely and more. Pick the right one.",
    },
  });
}

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
