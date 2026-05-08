import type { Metadata } from "next";
import { makePageMetadata } from "@/lib/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return makePageMetadata("/services", {
    ru: {
      title: "Услуги Tez Motors — подбор, доставка, таможня",
      description:
        "Полный цикл импорта авто из Китая: подбор, покупка, доставка, таможня, документы. Персональный менеджер на каждом этапе.",
    },
    uz: {
      title: "Tez Motors xizmatlari — tanlash, yetkazib berish, bojxona",
      description:
        "Xitoydan avtomobil importining to'liq sikli: tanlash, sotib olish, yetkazib berish, bojxona, hujjatlar. Har bir bosqichda menejer.",
    },
    en: {
      title: "Tez Motors services — sourcing, delivery, customs",
      description:
        "Full-cycle car imports from China: sourcing, purchase, shipping, customs, paperwork. A dedicated manager at every step.",
    },
  });
}

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
