"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

const EXPORT_TYPES = ["leads", "inventory", "invoices", "expenses"] as const;

const COPY: Record<Locale, {
  title: string;
  intro: string;
  items: Record<(typeof EXPORT_TYPES)[number], { label: string; desc: string }>;
}> = {
  ru: {
    title: "Экспорт",
    intro:
      "Скачайте свои данные в формате CSV (UTF-8, открывается в Excel/Sheets) — для бухгалтера, отчётности или анализа.",
    items: {
      leads: { label: "Лиды / заявки", desc: "Каждая заявка: имя, телефон, email, тип, статус, источник." },
      inventory: { label: "Склад + маржа", desc: "Автомобили с ценой продажи, вашей себестоимостью и валовой маржой." },
      invoices: { label: "Счета", desc: "Все счета с промежуточным итогом, НДС и итогом." },
      expenses: { label: "Расходы", desc: "Все расходы, включая валюту и сумму в долларах США." },
    },
  },
  uz: {
    title: "Eksport",
    intro:
      "Ma'lumotlaringizni CSV formatida yuklab oling (UTF-8, Excel/Sheets'da ochiladi) — buxgalter, hisobot yoki tahlil uchun.",
    items: {
      leads: { label: "Lidlar / so'rovlar", desc: "Har bir so'rov: ism, telefon, email, tur, holat, manba." },
      inventory: { label: "Ombor + marja", desc: "Sotuv narxi, tannarxingiz va yalpi marja bilan avtomobillar." },
      invoices: { label: "Hisob-fakturalar", desc: "Barcha hisob-fakturalar oraliq summa, QQS va jami bilan." },
      expenses: { label: "Xarajatlar", desc: "Barcha xarajatlar, jumladan valyuta va AQSh dollaridagi summa." },
    },
  },
  en: {
    title: "Export",
    intro:
      "Download your data as CSV (UTF-8, opens in Excel/Sheets) — for your accountant, records, or analysis.",
    items: {
      leads: { label: "Leads / inquiries", desc: "Every inquiry: name, phone, email, type, status, source." },
      inventory: { label: "Inventory + margins", desc: "Cars with list price, your cost and gross margin." },
      invoices: { label: "Invoices", desc: "All invoices with subtotal, VAT and total." },
      expenses: { label: "Expenses", desc: "All expenses incl. currency and USD-normalized amount." },
    },
  },
};

export default function AdminExportPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <FileSpreadsheet className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {t.intro}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {EXPORT_TYPES.map((type) => (
          <a
            key={type}
            href={`/api/admin/export/${type}`}
            className="bg-card border border-border p-4 rounded-[2px] hover:border-[var(--accent)] transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{t.items[type].label}</span>
              <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t.items[type].desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
