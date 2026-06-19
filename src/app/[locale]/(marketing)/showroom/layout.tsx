import type { Metadata } from "next";
import { makePageMetadata } from "@/lib/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return makePageMetadata("/showroom", {
    ru: {
      title: "Виртуальный шоурум — 360° осмотр и трейд-ин — Tez Motors",
      description:
        "Осмотрите авто в 360° онлайн и получите оценку трейд-ина по фото — не выходя из дома. Tez Motors.",
    },
    uz: {
      title: "Virtual shourum — 360° ko'rik va treyd-in — Tez Motors",
      description:
        "Avtoni 360° onlayn ko'ring va suratlar bo'yicha treyd-in bahosini oling — uydan chiqmasdan. Tez Motors.",
    },
    en: {
      title: "Virtual showroom — 360° inspection & trade-in — Tez Motors",
      description:
        "Inspect cars in 360° online and get a photo-based trade-in estimate — from the comfort of home. Tez Motors.",
    },
  });
}

export default function ShowroomLayout({ children }: { children: React.ReactNode }) {
  return children;
}
