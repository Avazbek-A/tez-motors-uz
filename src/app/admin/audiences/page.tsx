"use client";

import { Users2, Download } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

/**
 * First-party audience activation (Phase AW). Download hashed-identifier CSVs
 * to upload to Meta / Google as Custom Audiences — for lookalikes and, the
 * cheap win, suppressing existing customers from acquisition campaigns.
 */
const AUDIENCE_KEYS = ["delivered_customers", "all_customers", "open_leads"] as const;

const COPY: Record<Locale, {
  title: string;
  intro: string;
  audiences: Record<(typeof AUDIENCE_KEYS)[number], { label: string; use: string }>;
}> = {
  ru: {
    title: "Аудитории",
    intro: "Экспортируйте собственные аудитории в виде SHA-256-хешированных идентификаторов (формат, который принимают Meta и Google Customer Match — сырые email/телефоны никогда не покидают файл в открытом виде). Загрузите CSV как Custom Audience, затем постройте на её основе lookalike или используйте как исключение, чтобы привлекающая реклама пропускала ваших существующих клиентов.",
    audiences: {
      delivered_customers: { label: "Клиенты с доставкой", use: "Основа для lookalike (ваши лучшие покупатели) — найдите похожих." },
      all_customers: { label: "Все клиенты", use: "Список ИСКЛЮЧЕНИЙ — исключите из привлекающей рекламы, чтобы не платить за повторный охват тех, кто уже с вами." },
      open_leads: { label: "Открытые лиды", use: "Ретаргетинг — тёплые лиды, ещё не закрытые." },
    },
  },
  uz: {
    title: "Auditoriyalar",
    intro: "O‘zingizning auditoriyalaringizni SHA-256 bilan xeshlangan identifikatorlar sifatida eksport qiling (Meta va Google Customer Match qabul qiladigan format — xom email/telefonlar faylda hech qachon ochiq qolmaydi). CSV ni Custom Audience sifatida yuklang, so‘ng undan lookalike quring yoki istisno sifatida foydalaning, shunda jalb qilish reklamasi mavjud mijozlaringizni o‘tkazib yuboradi.",
    audiences: {
      delivered_customers: { label: "Yetkazib berilgan mijozlar", use: "Lookalike asosi (eng yaxshi xaridorlaringiz) — o‘xshashlarini toping." },
      all_customers: { label: "Barcha mijozlar", use: "ISTISNO ro‘yxati — jalb qilish reklamasidan chiqarib tashlang, allaqachon sizda bo‘lganlarni qayta qamrab olishga pul to‘lamang." },
      open_leads: { label: "Ochiq lidlar", use: "Retargeting — hali yopilmagan iliq lidlar." },
    },
  },
  en: {
    title: "Audiences",
    intro: "Export first-party audiences as SHA-256-hashed identifiers (the format Meta & Google Customer Match ingest — raw emails/phones never leave in the file). Upload a CSV as a Custom Audience, then build a lookalike from it, or use it as an exclusion so acquisition ads skip your existing customers.",
    audiences: {
      delivered_customers: { label: "Delivered customers", use: "Lookalike seed (your best buyers) — find more like them." },
      all_customers: { label: "All customers", use: "SUPPRESSION list — exclude from acquisition ads so you stop paying to re-reach people you already have." },
      open_leads: { label: "Open leads", use: "Retargeting — warm leads not yet closed." },
    },
  },
};

export default function AdminAudiencesPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users2 className="h-5 w-5 text-lime" />
        <h1 className="text-xl font-bold">{t.title}</h1>
      </div>
      <p className="text-sm text-white/60 max-w-2xl">
        {t.intro}
      </p>
      <div className="space-y-3">
        {AUDIENCE_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
            <div>
              <div className="font-medium">{t.audiences[key].label}</div>
              <div className="text-xs text-white/50">{t.audiences[key].use}</div>
            </div>
            <a
              href={`/api/admin/audience/export?audience=${key}`}
              className="inline-flex items-center gap-1 rounded bg-lime px-3 py-2 text-sm font-medium text-navy"
            >
              <Download className="h-4 w-4" /> CSV
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
