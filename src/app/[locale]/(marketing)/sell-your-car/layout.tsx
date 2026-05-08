import type { Metadata } from "next";
import { makePageMetadata } from "@/lib/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return makePageMetadata("/sell-your-car", {
    ru: {
      title: "Продайте свой автомобиль — Tez Motors",
      description:
        "Продайте свой авто Tez Motors или сдайте в trade-in при покупке нового. Быстрая оценка по фотографиям.",
    },
    uz: {
      title: "Avtomobilingizni soting — Tez Motors",
      description:
        "Avtomobilingizni Tez Motors'ga soting yoki yangisiga almashtirib oling. Suratlar bo'yicha tezkor baholash.",
    },
    en: {
      title: "Sell your car — Tez Motors",
      description:
        "Sell your car to Tez Motors or trade it in toward a new one. Fast valuation from photos.",
    },
  });
}

export default function SellYourCarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
