import type { Metadata } from "next";
import { makePageMetadata } from "@/lib/seo/page-metadata";

export { default } from "@/app/page";

// Homepage canonical + hreflang + localized title/description (path = "").
// Titles are brand-free; the root layout's "%s | Tez Motors" template adds the brand.
export function generateMetadata(): Promise<Metadata> {
  return makePageMetadata("", {
    ru: {
      title: "Импорт авто из Китая в Узбекистан под ключ",
      description: "BYD, Chery, Haval, Geely, Changan. Подбор, доставка, таможня, гарантия — авто из Китая в Ташкент под ключ.",
    },
    uz: {
      title: "Xitoydan O'zbekistonga avtomobil importi — kalit topshirish",
      description: "BYD, Chery, Haval, Geely, Changan. Tanlov, yetkazib berish, bojxona, kafolat — Xitoydan Toshkentga avtomobil.",
    },
    en: {
      title: "China car import to Uzbekistan — turnkey",
      description: "BYD, Chery, Haval, Geely, Changan. Sourcing, delivery, customs, warranty — cars from China to Tashkent, turnkey.",
    },
  });
}
