"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Hourglass, Loader2 } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface Item {
  id: string;
  slug: string;
  brand: string;
  model: string;
  year: number | null;
  currentPriceUsd: number;
  marketFairUsd: number;
  suggestedPriceUsd: number;
  markdownUsd: number;
  markdownPct: number;
  daysInStock: number;
  costUsd: number | null;
  holdingCostUsd: number;
  negotiationFloorUsd: number;
  marketTrendPct: number | null;
  reason: string;
  urgency: "high" | "medium" | "low";
}

const usd = (n: number | null) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));

const URGENCY_TONE: Record<string, string> = {
  high: "text-[var(--danger)] border-[var(--danger)]",
  medium: "text-[var(--warning)] border-[var(--warning)]",
  low: "text-muted-foreground border-border",
};

const COPY: Record<Locale, {
  title: string;
  intro: string;
  empty: string;
  trapped: (n: string) => string;
  thModel: string;
  thCurrent: string;
  thFair: string;
  thSuggested: string;
  thMarkdown: string;
  thAge: string;
  thWhy: string;
}> = {
  ru: {
    title: "Переоценка склада",
    intro: "Ваши машины в наличии против рыночной справедливой цены (с поправкой на пробег) и срока на складе. Где капитал застрял — рекомендация снизить цену. Снижает замороженные деньги.",
    empty: "Нет рекомендаций по переоценке — либо склад свеж и в рынке, либо мало рыночных данных по этим моделям.",
    trapped: (n) => `Стоимость удержания капитала по складу: ${n}`,
    thModel: "Машина",
    thCurrent: "Текущая",
    thFair: "Рынок",
    thSuggested: "Реком.",
    thMarkdown: "Снижение",
    thAge: "На складе",
    thWhy: "Почему",
  },
  uz: {
    title: "Qayta narxlash",
    intro: "Mavjud mashinalaringiz bozor adolatli narxiga (probeg hisobga olingan) va omborda turgan muddatga nisbatan. Kapital qotib qolgan joyda — narxni tushirish tavsiyasi.",
    empty: "Qayta narxlash tavsiyalari yo'q — ombor yangi va bozorga mos, yoki bu modellar bo'yicha ma'lumot kam.",
    trapped: (n) => `Ombor bo'yicha kapital ushlab turish narxi: ${n}`,
    thModel: "Mashina",
    thCurrent: "Joriy",
    thFair: "Bozor",
    thSuggested: "Tavsiya",
    thMarkdown: "Tushirish",
    thAge: "Omborda",
    thWhy: "Sababi",
  },
  en: {
    title: "Repricing",
    intro: "Your in-stock cars vs the market's mileage-adjusted fair value and time on the lot. Where capital is stuck, a suggested markdown — frees trapped cash.",
    empty: "No repricing suggestions — stock is fresh and market-aligned, or there's too little market data for these models.",
    trapped: (n) => `Capital holding cost across stock: ${n}`,
    thModel: "Car",
    thCurrent: "Current",
    thFair: "Market",
    thSuggested: "Suggested",
    thMarkdown: "Markdown",
    thAge: "In stock",
    thWhy: "Why",
  },
};

export default function AdminRepricingPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [items, setItems] = useState<Item[]>([]);
  const [trapped, setTrapped] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/repricing")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) {
          setItems(d.items || []);
          setTrapped(d.totalHoldingCostUsd || 0);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl">
      <div className="mb-1 flex items-center gap-3">
        <Hourglass className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t.intro}</p>

      {!loading && items.length > 0 && (
        <p className="mb-5 text-xs font-mono text-muted-foreground">{t.trapped(usd(trapped))}</p>
      )}

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <div className="overflow-x-auto border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t.thModel}</th>
                <th className="px-3 py-2 text-right font-medium">{t.thCurrent}</th>
                <th className="px-3 py-2 text-right font-medium">{t.thFair}</th>
                <th className="px-3 py-2 text-right font-medium">{t.thSuggested}</th>
                <th className="px-3 py-2 text-right font-medium">{t.thMarkdown}</th>
                <th className="px-3 py-2 text-right font-medium">{t.thAge}</th>
                <th className="px-3 py-2 font-medium">{t.thWhy}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/cars?q=${encodeURIComponent(it.model)}`} className="text-foreground hover:text-primary hover:underline">
                      {it.brand} {it.model} {it.year ? <span className="text-muted-foreground">{it.year}</span> : null}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-foreground">{usd(it.currentPriceUsd)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-muted-foreground" title={`${it.costUsd != null ? `cost ${usd(it.costUsd)} · ` : ""}holding cost so far ${usd(it.holdingCostUsd)} · floor ${usd(it.negotiationFloorUsd)}`}>{usd(it.marketFairUsd)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-[var(--accent)]">{usd(it.suggestedPriceUsd)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[var(--danger)]">−{usd(it.markdownUsd)} <span className="text-[11px] opacity-70">{it.markdownPct}%</span></td>
                  <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{it.daysInStock}d</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block rounded-[2px] border px-1.5 py-0.5 text-[10px] font-mono ${URGENCY_TONE[it.urgency]}`} title={it.reason}>
                      {it.reason}
                    </span>
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
