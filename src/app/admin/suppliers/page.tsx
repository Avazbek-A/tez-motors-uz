"use client";

import { useEffect, useState } from "react";
import { Factory, Loader2, Plus } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface Supplier {
  id: string;
  name: string;
  contact: string | null;
  whatsapp: string | null;
  country: string | null;
  lead_time_days: number | null;
  moq: number | null;
  payment_terms: string | null;
  reliability_score: number | null;
  orders: number;
  avg_unit_cost_usd: number | null;
  on_time_pct: number | null;
  shipments_tracked: number;
}

const COPY: Record<Locale, {
  title: string;
  supplierNamePlaceholder: string;
  whatsappPlaceholder: string;
  add: string;
  loading: string;
  noSuppliers: string;
  thSupplier: string;
  thCountry: string;
  thOrders: string;
  thAvgCost: string;
  thOnTime: string;
  thLeadMoq: string;
  thWhatsapp: string;
}> = {
  ru: {
    title: "Поставщики",
    supplierNamePlaceholder: "Название поставщика",
    whatsappPlaceholder: "WhatsApp (необязательно)",
    add: "Добавить",
    loading: "Загрузка…",
    noSuppliers: "Пока нет поставщиков. Добавьте одного выше, или они появятся по мере регистрации заказов на закупку.",
    thSupplier: "Поставщик",
    thCountry: "Страна",
    thOrders: "Заказы",
    thAvgCost: "Сред. цена",
    thOnTime: "В срок",
    thLeadMoq: "Срок / MOQ",
    thWhatsapp: "WhatsApp",
  },
  uz: {
    title: "Yetkazib beruvchilar",
    supplierNamePlaceholder: "Yetkazib beruvchi nomi",
    whatsappPlaceholder: "WhatsApp (ixtiyoriy)",
    add: "Qo'shish",
    loading: "Yuklanmoqda…",
    noSuppliers: "Hozircha yetkazib beruvchilar yo'q. Yuqorida bittasini qo'shing yoki ular xarid buyurtmalarini qayd etganingizda paydo bo'ladi.",
    thSupplier: "Yetkazib beruvchi",
    thCountry: "Davlat",
    thOrders: "Buyurtmalar",
    thAvgCost: "O'rt. narx",
    thOnTime: "O'z vaqtida",
    thLeadMoq: "Muddat / MOQ",
    thWhatsapp: "WhatsApp",
  },
  en: {
    title: "Suppliers",
    supplierNamePlaceholder: "Supplier name",
    whatsappPlaceholder: "WhatsApp (optional)",
    add: "Add",
    loading: "Loading…",
    noSuppliers: "No suppliers yet. Add one above, or they’ll appear as you log purchase orders.",
    thSupplier: "Supplier",
    thCountry: "Country",
    thOrders: "Orders",
    thAvgCost: "Avg cost",
    thOnTime: "On-time",
    thLeadMoq: "Lead / MOQ",
    thWhatsapp: "WhatsApp",
  },
};

export default function AdminSuppliersPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/suppliers");
      const data = await res.json();
      setRows(data.suppliers || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!name.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/admin/suppliers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, whatsapp: whatsapp || null }),
      });
      setName("");
      setWhatsapp("");
      await load();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Factory className="h-5 w-5 text-lime" />
        <h1 className="text-xl font-bold">{t.title}</h1>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-white/10 bg-white/5 p-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.supplierNamePlaceholder}
          className="rounded border border-white/15 bg-black/20 px-3 py-2 text-sm"
        />
        <input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder={t.whatsappPlaceholder}
          className="rounded border border-white/15 bg-black/20 px-3 py-2 text-sm"
        />
        <button
          onClick={add}
          disabled={adding || !name.trim()}
          className="inline-flex items-center gap-1 rounded bg-lime px-3 py-2 text-sm font-medium text-navy disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> {t.add}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> {t.loading}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-white/50 text-sm">{t.noSuppliers}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase text-white/50">
              <tr>
                <th className="px-3 py-2">{t.thSupplier}</th>
                <th className="px-3 py-2">{t.thCountry}</th>
                <th className="px-3 py-2">{t.thOrders}</th>
                <th className="px-3 py-2">{t.thAvgCost}</th>
                <th className="px-3 py-2">{t.thOnTime}</th>
                <th className="px-3 py-2">{t.thLeadMoq}</th>
                <th className="px-3 py-2">{t.thWhatsapp}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-white/5">
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2 text-white/60">{s.country || "—"}</td>
                  <td className="px-3 py-2">{s.orders}</td>
                  <td className="px-3 py-2">{s.avg_unit_cost_usd ? `$${s.avg_unit_cost_usd.toLocaleString("en-US")}` : "—"}</td>
                  <td className="px-3 py-2">
                    {s.on_time_pct != null ? (
                      <span className={s.on_time_pct >= 80 ? "text-lime" : s.on_time_pct >= 50 ? "text-yellow-400" : "text-red-400"}>
                        {s.on_time_pct}% ({s.shipments_tracked})
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-white/60">
                    {s.lead_time_days != null ? `${s.lead_time_days}d` : "—"} / {s.moq ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-white/60">
                    {s.whatsapp ? (
                      <a href={`https://wa.me/${s.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-lime hover:underline">
                        {s.whatsapp}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
