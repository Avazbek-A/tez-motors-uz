import type { Metadata } from "next";
import { makePageMetadata } from "@/lib/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return makePageMetadata("/about", {
    ru: {
      title: "О компании Tez Motors — импорт авто из Китая",
      description:
        "Tez Motors — надёжный партнёр по импорту автомобилей из Китая в Узбекистан. Наша миссия, ценности и история компании.",
    },
    uz: {
      title: "Tez Motors haqida — Xitoydan avtomobil importi",
      description:
        "Tez Motors — Xitoydan O'zbekistonga avtomobil importi bo'yicha ishonchli hamkor. Bizning missiyamiz va tariximiz.",
    },
    en: {
      title: "About Tez Motors — China car importer in Tashkent",
      description:
        "Tez Motors is a reliable partner for importing cars from China to Uzbekistan. Our mission, values, and story.",
    },
  });
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
