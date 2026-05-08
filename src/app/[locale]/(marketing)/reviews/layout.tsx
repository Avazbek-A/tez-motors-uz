import type { Metadata } from "next";
import { makePageMetadata } from "@/lib/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return makePageMetadata("/reviews", {
    ru: {
      title: "Отзывы клиентов Tez Motors — реальные истории",
      description:
        "Отзывы клиентов Tez Motors об импорте автомобилей из Китая в Узбекистан. Реальные истории и оценки.",
    },
    uz: {
      title: "Tez Motors mijozlari sharhlari",
      description:
        "Xitoydan O'zbekistonga avtomobil import qilgan Tez Motors mijozlarining sharhlari va baholari.",
    },
    en: {
      title: "Tez Motors customer reviews — real stories",
      description:
        "Reviews from Tez Motors customers about importing cars from China to Uzbekistan. Real stories and ratings.",
    },
  });
}

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
