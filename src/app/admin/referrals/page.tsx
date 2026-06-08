"use client";

import { useEffect, useState } from "react";
import { Gift, Loader2 } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface Row { id: string; name: string | null; phone: string | null; referred: number; converted: number }
interface Totals { referrers: number; referred: number; converted: number }

const COPY: Record<Locale, {
  title: string;
  referrers: string;
  referred: string;
  converted: string;
  loading: string;
  empty: string;
  colReferrer: string;
  colReferred: string;
  colConverted: string;
}> = {
  ru: {
    title: "Рефералы",
    referrers: "рефереров",
    referred: "приглашено",
    converted: "конверсий",
    loading: "Загрузка…",
    empty: "Пока нет рефералов. Клиенты получают код в личном кабинете; конверсии отображаются здесь.",
    colReferrer: "Реферер",
    colReferred: "Приглашено",
    colConverted: "Конверсии",
  },
  uz: {
    title: "Tavsiyalar",
    referrers: "referer",
    referred: "taklif qilingan",
    converted: "konversiya",
    loading: "Yuklanmoqda…",
    empty: "Hali tavsiyalar yo‘q. Mijozlar shaxsiy kabinetida kod oladi; konversiyalar shu yerda ko‘rinadi.",
    colReferrer: "Referer",
    colReferred: "Taklif qilingan",
    colConverted: "Konversiyalar",
  },
  en: {
    title: "Referrals",
    referrers: "referrers",
    referred: "referred",
    converted: "converted",
    loading: "Loading…",
    empty: "No referrals yet. Customers get a code in their account; conversions show here.",
    colReferrer: "Referrer",
    colReferred: "Referred",
    colConverted: "Converted",
  },
};

export default function AdminReferralsPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/referrals");
        const data = await res.json();
        setRows(data.leaderboard || []);
        setTotals(data.totals || null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-lime" />
        <h1 className="text-xl font-bold">{t.title}</h1>
      </div>
      {totals && (
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="rounded border border-white/10 bg-white/5 px-4 py-2">{totals.referrers} {t.referrers}</div>
          <div className="rounded border border-white/10 bg-white/5 px-4 py-2">{totals.referred} {t.referred}</div>
          <div className="rounded border border-white/10 bg-white/5 px-4 py-2 text-lime">{totals.converted} {t.converted}</div>
        </div>
      )}
      {loading ? (
        <div className="flex items-center gap-2 text-white/60"><Loader2 className="h-4 w-4 animate-spin" /> {t.loading}</div>
      ) : rows.length === 0 ? (
        <p className="text-white/50 text-sm">{t.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase text-white/50">
              <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">{t.colReferrer}</th><th className="px-3 py-2 text-right">{t.colReferred}</th><th className="px-3 py-2 text-right">{t.colConverted}</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-3 py-2 text-white/40">{i + 1}</td>
                  <td className="px-3 py-2"><div className="font-medium">{r.name || "—"}</div><div className="text-white/50">{r.phone || ""}</div></td>
                  <td className="px-3 py-2 text-right font-mono text-white/70">{r.referred}</td>
                  <td className="px-3 py-2 text-right font-mono text-lime">{r.converted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
