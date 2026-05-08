import type { Metadata } from "next";
import { makePageMetadata } from "@/lib/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return makePageMetadata("/privacy", {
    ru: {
      title: "Политика конфиденциальности — Tez Motors",
      description:
        "Как Tez Motors собирает, использует и защищает ваши персональные данные при импорте автомобилей из Китая.",
    },
    uz: {
      title: "Maxfiylik siyosati — Tez Motors",
      description:
        "Tez Motors shaxsiy ma'lumotlaringizni qanday yig'ishi, ishlatishi va himoya qilishi haqida.",
    },
    en: {
      title: "Privacy policy — Tez Motors",
      description:
        "How Tez Motors collects, uses, and protects your personal data when importing cars from China.",
    },
  });
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
