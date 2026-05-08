import type { Metadata } from "next";
import { makePageMetadata } from "@/lib/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return makePageMetadata("/track", {
    ru: {
      title: "Отслеживание заказа — Tez Motors",
      description:
        "Отследите статус доставки вашего автомобиля из Китая. Введите номер заказа для актуальной информации.",
    },
    uz: {
      title: "Buyurtmangizni kuzatish — Tez Motors",
      description:
        "Xitoydan kelayotgan avtomobil yetkazib berish holatini kuzating. Buyurtma raqamini kiriting.",
    },
    en: {
      title: "Order tracking — Tez Motors",
      description:
        "Track the delivery status of your car from China. Enter your order number for live updates.",
    },
  });
}

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
