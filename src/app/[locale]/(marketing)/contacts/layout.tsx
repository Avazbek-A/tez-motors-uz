import type { Metadata } from "next";
import { makePageMetadata } from "@/lib/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return makePageMetadata("/contacts", {
    ru: {
      title: "Контакты — Tez Motors",
      description:
        "Свяжитесь с Tez Motors: телефон, email, Telegram, WhatsApp, адрес офиса в Ташкенте. На связи 6 дней в неделю.",
    },
    uz: {
      title: "Aloqa — Tez Motors",
      description:
        "Tez Motors bilan bog'laning: telefon, email, Telegram, WhatsApp, Toshkentdagi ofis manzili. Haftada 6 kun ish faolmiz.",
    },
    en: {
      title: "Contacts — Tez Motors",
      description:
        "Reach Tez Motors: phone, email, Telegram, WhatsApp, Tashkent office address. Available 6 days a week.",
    },
  });
}

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
