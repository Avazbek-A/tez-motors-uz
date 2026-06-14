"use client";

import { useEffect, useState } from "react";
import { Tag, Loader2, ExternalLink } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface Deal {
  brand: string;
  model: string;
  year: number | null;
  priceUsd: number;
  fairUsd: number;
  discountPct: number;
  underUsd: number;
  mileageKm: number | null;
  city: string | null;
  seller: "dealer" | "private";
  motivation: number;
  source: string;
  sourceRef: string | null;
  ageDays: number;
  score: number;
}

interface VinFlag {
  vin: string;
  sightings: number;
  firstKm: number | null;
  lastKm: number | null;
}

const usd = (n: number | null) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));
const isUrl = (s: string | null) => !!s && /^https?:\/\//.test(s);

const COPY: Record<Locale, {
  title: string;
  intro: string;
  empty: string;
  thModel: string;
  thPrice: string;
  thFair: string;
  thDiscount: string;
  thMileage: string;
  thCity: string;
  thSeller: string;
  thSource: string;
  seller: Record<string, string>;
  motivated: string;
  open: string;
}> = {
  ru: {
    title: "Выгодные сделки",
    intro: "Живые объявления, оценённые ниже справедливой цены модели (с поправкой на пробег). Цель — купить и перепродать. Ранжировано по скидке × мотивация продавца, частники в приоритете.",
    empty: "Пока нет сделок — нужны рыночные данные. Запустите сборщики и дайте им накопиться.",
    thModel: "Модель",
    thPrice: "Цена",
    thFair: "Справедл.",
    thDiscount: "Скидка",
    thMileage: "Пробег",
    thCity: "Город",
    thSeller: "Продавец",
    thSource: "Источник",
    seller: { dealer: "салон", private: "частник" },
    motivated: "мотивирован",
    open: "открыть",
  },
  uz: {
    title: "Foydali bitimlar",
    intro: "Model adolatli narxidan past baholangan jonli e'lonlar (probeg hisobga olingan). Maqsad — sotib olib qayta sotish. Chegirma × sotuvchi motivatsiyasi bo'yicha, shaxsiy sotuvchilar ustun.",
    empty: "Hozircha bitimlar yo'q — bozor ma'lumotlari kerak. Yig'uvchilarni ishga tushiring.",
    thModel: "Model",
    thPrice: "Narx",
    thFair: "Adolatli",
    thDiscount: "Chegirma",
    thMileage: "Probeg",
    thCity: "Shahar",
    thSeller: "Sotuvchi",
    thSource: "Manba",
    seller: { dealer: "salon", private: "shaxsiy" },
    motivated: "motivatsiya",
    open: "ochish",
  },
  en: {
    title: "Deal Sniper",
    intro: "Live listings priced below their model's mileage-adjusted fair value — buy-low-resell targets. Ranked by discount × seller motivation; private sellers favored.",
    empty: "No deals yet — needs market data. Run the collectors and let them accrue.",
    thModel: "Model",
    thPrice: "Price",
    thFair: "Fair",
    thDiscount: "Discount",
    thMileage: "Mileage",
    thCity: "City",
    thSeller: "Seller",
    thSource: "Source",
    seller: { dealer: "dealer", private: "private" },
    motivated: "motivated",
    open: "open",
  },
};

export default function AdminDealsPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [deals, setDeals] = useState<Deal[]>([]);
  const [vinFlags, setVinFlags] = useState<VinFlag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/deals")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) {
          setDeals(d.deals || []);
          setVinFlags(d.vinFlags || []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl">
      <div className="mb-1 flex items-center gap-3">
        <Tag className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">{t.intro}</p>

      {vinFlags.length > 0 && (
        <div className="mb-5 border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-3 py-2 text-xs">
          <span className="font-medium text-[var(--danger)]">⚠ {vinFlags.length} odometer-rollback VIN(s)</span>
          <span className="ml-2 text-muted-foreground">— same VIN relisted with lower mileage; verify before buying.</span>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
            {vinFlags.map((v) => (
              <span key={v.vin}>{v.vin.slice(-8)}: {v.firstKm != null ? Math.round(v.firstKm / 1000) + "k" : "?"}→{v.lastKm != null ? Math.round(v.lastKm / 1000) + "k" : "?"}</span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
      ) : deals.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <div className="overflow-x-auto border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t.thModel}</th>
                <th className="px-3 py-2 text-right font-medium">{t.thPrice}</th>
                <th className="px-3 py-2 text-right font-medium">{t.thFair}</th>
                <th className="px-3 py-2 text-right font-medium">{t.thDiscount}</th>
                <th className="px-3 py-2 text-right font-medium">{t.thMileage}</th>
                <th className="px-3 py-2 font-medium">{t.thCity}</th>
                <th className="px-3 py-2 font-medium">{t.thSeller}</th>
                <th className="px-3 py-2 font-medium">{t.thSource}</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5">
                    <div className="text-foreground">
                      {d.brand} {d.model} {d.year ? <span className="text-muted-foreground">{d.year}</span> : null}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {d.ageDays}d ago{d.motivation >= 0.3 ? ` · ${t.motivated} ${Math.round(d.motivation * 100)}%` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-foreground">{usd(d.priceUsd)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{usd(d.fairUsd)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[var(--success)]" title={`${usd(d.underUsd)} under fair`}>
                    −{d.discountPct}%
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{d.mileageKm != null ? `${Math.round(d.mileageKm / 1000)}k` : "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{d.city || "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[11px] ${d.seller === "private" ? "text-[var(--success)]" : "text-muted-foreground"}`}>{t.seller[d.seller]}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {isUrl(d.sourceRef) ? (
                      <a href={d.sourceRef!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                        {d.source} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="font-mono text-[11px] text-muted-foreground">{d.source}</span>
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
