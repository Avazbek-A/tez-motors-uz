import type { Metadata } from "next";
import { makePageMetadata } from "@/lib/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return makePageMetadata("/faq", {
    ru: {
      title: "FAQ — частые вопросы об импорте авто из Китая",
      description:
        "Ответы на популярные вопросы: сроки доставки, растаможка, предоплата, гарантия. Импорт авто из Китая в Узбекистан.",
    },
    uz: {
      title: "FAQ — Xitoydan avto import qilish bo'yicha savollar",
      description:
        "Yetkazib berish muddatlari, bojxona, oldindan to'lov va kafolat bo'yicha tez-tez beriladigan savollarga javoblar.",
    },
    en: {
      title: "FAQ — China car imports to Uzbekistan",
      description:
        "Answers to common questions: delivery times, customs clearance, deposits, warranty. China-to-Uzbekistan car imports.",
    },
  });
}

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
