"use client";

import { useCallback, useEffect, useState } from "react";
import { Hourglass, Loader2, TrendingDown, TrendingUp, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface Row {
  car_id: string; name: string; price_usd: number; daysOnLot: number; demandScore: number;
  markdownPct: number; suggestedPriceUsd: number; increasePct: number; increasePriceUsd: number;
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

const COPY: Record<Locale, {
  title: string; intro: string; considerMarkdown: string; noAged: string;
  couldRaise: string; car: string; days: string; demand: string; price: string;
  suggested: string; promo: string;
  promoLabel: (pct: number, days: number) => string;
  promoCreated: (name: string, price: string) => string;
  couldNotCreate: string;
}> = {
  ru: {
    title: "Залежавшийся товар и переоценка",
    intro: "Капитал, простаивающий на стоянке. Старые и невостребованные авто получают рекомендованную скидку (в один клик → акция); свежие и востребованные авто можно подорожать. Это только рекомендации — решение за вами.",
    considerMarkdown: "Рассмотреть скидку",
    noAged: "Нет залежавшихся и невостребованных авто — отлично.",
    couldRaise: "Можно поднять цену",
    car: "Авто",
    days: "Дней",
    demand: "Спрос",
    price: "Цена",
    suggested: "Рекомендовано",
    promo: "Акция",
    promoLabel: (pct, days) => `Скидка ${pct}% — на стоянке ${days} дн.`,
    promoCreated: (name, price) => `Акция создана для ${name} → ${price} (применится при следующем запуске cron).`,
    couldNotCreate: "Не удалось создать акцию.",
  },
  uz: {
    title: "Turib qolgan tovar va qayta narxlash",
    intro: "Maydonchada turib qolgan kapital. Eski va talab past avtomobillarga tavsiya etilgan chegirma beriladi (bir bosishda → aksiya); yangi va talabgir avtomobillar narxini ko'tarish mumkin. Bu faqat tavsiyalar — qaror sizniki.",
    considerMarkdown: "Chegirmani ko'rib chiqing",
    noAged: "Turib qolgan va talab past avtomobillar yo'q — ajoyib.",
    couldRaise: "Narxni ko'tarish mumkin",
    car: "Avtomobil",
    days: "Kun",
    demand: "Talab",
    price: "Narx",
    suggested: "Tavsiya etilgan",
    promo: "Aksiya",
    promoLabel: (pct, days) => `Chegirma ${pct}% — maydonchada ${days} kun`,
    promoCreated: (name, price) => `${name} uchun aksiya yaratildi → ${price} (keyingi cron ishga tushganda qo'llaniladi).`,
    couldNotCreate: "Aksiyani yaratib bo'lmadi.",
  },
  en: {
    title: "Aged stock & repricing",
    intro: "Capital sitting on the lot. Old + cold cars get a suggested markdown (one-click → promotion); fresh + in-demand cars could take a price increase. Suggestions only — you decide.",
    considerMarkdown: "Consider a markdown",
    noAged: "No aged + cold cars — nice.",
    couldRaise: "Could raise the price",
    car: "Car",
    days: "Days",
    demand: "Demand",
    price: "Price",
    suggested: "Suggested",
    promo: "Promo",
    promoLabel: (pct, days) => `Markdown ${pct}% — aged ${days}d`,
    promoCreated: (name, price) => `Promo created for ${name} → ${price} (applies on next cron run).`,
    couldNotCreate: "Could not create promo.",
  },
};

export default function AdminAgingPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [markdowns, setMarkdowns] = useState<Row[]>([]);
  const [increases, setIncreases] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/stats/aging").then((r) => r.json()).then((d) => {
      if (d?.ok) { setMarkdowns(d.markdowns || []); setIncreases(d.increases || []); }
    }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const createPromo = async (r: Row) => {
    setBusy(r.car_id); setNote(null);
    try {
      const res = await fetch("/api/admin/promotions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: r.car_id, fixed_price_usd: r.suggestedPriceUsd, label: t.promoLabel(r.markdownPct, r.daysOnLot) }),
      });
      const d = await res.json();
      setNote(res.ok ? t.promoCreated(r.name, usd(r.suggestedPriceUsd)) : d.error || t.couldNotCreate);
    } finally { setBusy(null); }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <Hourglass className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {t.intro}
      </p>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><TrendingDown className="w-4 h-4 text-[var(--danger)]" /> {t.considerMarkdown}</h2>
            {markdowns.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noAged}</p>
            ) : (
              <div className="bg-card border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="px-4 py-2 font-medium">{t.car}</th><th className="px-4 py-2 font-medium text-right">{t.days}</th>
                    <th className="px-4 py-2 font-medium text-right">{t.demand}</th><th className="px-4 py-2 font-medium text-right">{t.price}</th>
                    <th className="px-4 py-2 font-medium text-right">{t.suggested}</th><th className="px-4 py-2 text-right"></th>
                  </tr></thead>
                  <tbody>
                    {markdowns.map((r) => (
                      <tr key={r.car_id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 text-foreground">{r.name}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-[var(--warning)]">{r.daysOnLot}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{r.demandScore}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-muted-foreground line-through">{usd(r.price_usd)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-foreground">{usd(r.suggestedPriceUsd)} <span className="text-[var(--danger)] text-xs">-{r.markdownPct}%</span></td>
                        <td className="px-4 py-2.5 text-right">
                          <Button size="sm" variant="outline" onClick={() => createPromo(r)} disabled={busy === r.car_id}>
                            {busy === r.car_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Tag className="w-3.5 h-3.5" /> {t.promo}</>}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {increases.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-[var(--success)]" /> {t.couldRaise}</h2>
              <div className="bg-card border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="px-4 py-2 font-medium">{t.car}</th><th className="px-4 py-2 font-medium text-right">{t.days}</th>
                    <th className="px-4 py-2 font-medium text-right">{t.demand}</th><th className="px-4 py-2 font-medium text-right">{t.price}</th>
                    <th className="px-4 py-2 font-medium text-right">{t.suggested}</th>
                  </tr></thead>
                  <tbody>
                    {increases.map((r) => (
                      <tr key={r.car_id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 text-foreground">{r.name}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{r.daysOnLot}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-[var(--success)]">{r.demandScore}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{usd(r.price_usd)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-foreground">{usd(r.increasePriceUsd)} <span className="text-[var(--success)] text-xs">+{r.increasePct}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {note && <p className="text-xs text-primary">{note}</p>}
        </div>
      )}
    </div>
  );
}
