import type { Metadata } from "next";
import { makePageMetadata } from "@/lib/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const meta = await makePageMetadata("/account", {
    ru: {
      title: "Личный кабинет — Tez Motors",
      description: "Ваш гараж, сохранённые поиски и заказы Tez Motors.",
    },
    uz: {
      title: "Shaxsiy kabinet — Tez Motors",
      description: "Garajingiz, saqlangan qidiruvlar va Tez Motors buyurtmalari.",
    },
    en: {
      title: "My account — Tez Motors",
      description: "Your garage, saved searches and Tez Motors orders.",
    },
  });
  // Authenticated, per-user page — never index.
  return { ...meta, robots: { index: false, follow: false } };
}

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
