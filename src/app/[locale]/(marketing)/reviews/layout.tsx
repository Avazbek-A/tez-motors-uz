import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Отзывы клиентов",
  description: "Отзывы клиентов Tez Motors об импорте автомобилей из Китая в Узбекистан. Реальные истории и оценки.",
};

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
