import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Отслеживание заказа",
  description: "Отследите статус доставки вашего автомобиля из Китая. Введите номер заказа для получения актуальной информации.",
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
