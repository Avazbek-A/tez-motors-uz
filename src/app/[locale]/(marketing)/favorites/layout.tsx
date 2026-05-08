import type { Metadata } from "next";
import { makePageMetadata } from "@/lib/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const meta = await makePageMetadata("/favorites", {
    ru: {
      title: "Избранное — Tez Motors",
      description:
        "Сохранённые автомобили и подписки на снижение цен. Получайте уведомления, когда цена падает.",
    },
    uz: {
      title: "Saralangan — Tez Motors",
      description:
        "Saqlangan avtomobillar va narx pasayishi haqida obunalar. Narx tushganda xabardor bo'ling.",
    },
    en: {
      title: "Favorites — Tez Motors",
      description:
        "Saved cars and price-drop alerts. Get notified the moment the price changes.",
    },
  });
  // User-specific page — favorites are stored client-side per-visitor.
  // Don't index; nothing useful for search engines to crawl.
  return { ...meta, robots: { index: false, follow: true } };
}

export default function FavoritesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
