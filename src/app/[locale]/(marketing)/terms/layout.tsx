import type { Metadata } from "next";
import { makePageMetadata } from "@/lib/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return makePageMetadata("/terms", {
    ru: {
      title: "Условия использования — Tez Motors",
      description:
        "Условия использования сайта Tez Motors и правила работы с клиентами при импорте автомобилей из Китая.",
    },
    uz: {
      title: "Foydalanish shartlari — Tez Motors",
      description:
        "Tez Motors saytidan foydalanish shartlari va Xitoydan avtomobil importi bo'yicha mijozlar bilan ish qoidalari.",
    },
    en: {
      title: "Terms of service — Tez Motors",
      description:
        "Terms for using the Tez Motors site and rules of engagement for importing cars from China.",
    },
  });
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
