import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Часто задаваемые вопросы",
  description:
    "Ответы на популярные вопросы об импорте автомобилей из Китая: сроки доставки, растаможка, предоплата, гарантия.",
  openGraph: {
    title: "FAQ — Tez Motors",
    description: "Всё, что нужно знать об импорте авто из Китая в Узбекистан.",
  },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
