import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Контакты",
  description:
    "Свяжитесь с Tez Motors: телефон, email, Telegram, WhatsApp, адрес офиса в Ташкенте. Мы на связи 6 дней в неделю.",
  openGraph: {
    title: "Контакты — Tez Motors",
    description: "Свяжитесь с нами для заказа автомобиля из Китая.",
  },
};

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
