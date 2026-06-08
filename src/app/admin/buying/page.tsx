"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Target, Loader2, TrendingUp, Truck } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface Rec {
  brand: string;
  model: string;
  fuel: string;
  demand: { inquiries: number; watches: number; favorites: number; savedSearches: number };
  demandScore: number;
  marketMedianUsd: number | null;
  marketSample: number;
  marketFreshnessDays: number | null;
  supplierCostUsd: number | null;
  landedCostUsd: number | null;
  marginUsd: number | null;
  marginPct: number | null;
  suggestedPriceUsd: number | null;
  opportunityScore: number;
  verdict: string;
  recommendedQty: number;
}

const usd = (n: number | null) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));

const VERDICT_TONE: Record<string, string> = {
  strong_buy: "text-[var(--success)] border-[var(--success)]",
  buy: "text-[var(--accent)] border-[var(--accent)]",
  consider: "text-[var(--warning)] border-[var(--warning)]",
  skip: "text-muted-foreground border-border",
};

const COPY: Record<Locale, {
  title: string;
  intro: string;
  emptyPrefix: string;
  emptyMarketIntel: string;
  emptyMid: string;
  emptyProcurement: string;
  emptySuffix: string;
  thModel: string;
  thVerdict: string;
  thOpp: string;
  thDemand: string;
  thMarketMed: string;
  thLanded: string;
  thMargin: string;
  thQty: string;
  thAction: string;
  noMarketData: string;
  demandTitle: (inq: number, watch: number, fav: number, search: number) => string;
  createPoTitle: string;
  order: string;
  footnote: string;
  verdict: Record<string, string>;
}> = {
  ru: {
    title: "Закупочный мозг",
    intro:
      "Что импортировать дальше — спрос × рыночная цена × стоимость с доставкой, ранжировано по возможности. Каждая строка объединяет ваши запросы/отслеживания/поиски, медианы OLX/Telegram и движок расчёта таможенной стоимости.",
    emptyPrefix: "Пока нет рекомендаций — добавьте рыночные данные (",
    emptyMarketIntel: "Рыночная аналитика",
    emptyMid: "), отслеживайте затраты поставщиков (",
    emptyProcurement: "Закупки",
    emptySuffix: ") и дайте спросу накопиться.",
    thModel: "Модель",
    thVerdict: "Вердикт",
    thOpp: "Возм.",
    thDemand: "Спрос",
    thMarketMed: "Медиана рынка",
    thLanded: "С доставкой",
    thMargin: "Маржа",
    thQty: "Кол-во",
    thAction: "Действие",
    noMarketData: " · нет рыночных данных",
    demandTitle: (inq, watch, fav, search) =>
      `${inq} запр. · ${watch} отсл. · ${fav} избр. · ${search} поиск.`,
    createPoTitle: "Создать заказ на закупку",
    order: "заказать",
    footnote:
      "Возможность сочетает спрос (40%) и маржу (60%), масштабированную по достоверности рыночных данных. Для маржи нужна отслеживаемая стоимость поставщика (из заказа на закупку) и рыночные объявления; модели без одного из этого всё равно показываются только по спросу. Рекомендованная розничная цена по модели: см. калькулятор импорта.",
    verdict: {
      strong_buy: "Уверенная покупка",
      buy: "Покупать",
      consider: "Рассмотреть",
      skip: "Пропустить",
    },
  },
  uz: {
    title: "Xarid miyasi",
    intro:
      "Keyin nimani import qilish kerak — talab × bozor narxi × yetkazib berish bilan tannarx, imkoniyat bo'yicha tartiblangan. Har bir qator sizning so'rovlaringiz/kuzatuvlaringiz/qidiruvlaringiz, OLX/Telegram medianalari va bojxona yetkazib berish tannarxi dvigatelini birlashtiradi.",
    emptyPrefix: "Hozircha tavsiyalar yo'q — bozor ma'lumotlarini qo'shing (",
    emptyMarketIntel: "Bozor tahlili",
    emptyMid: "), yetkazib beruvchi xarajatlarini kuzating (",
    emptyProcurement: "Xaridlar",
    emptySuffix: ") va talab to'planishiga ruxsat bering.",
    thModel: "Model",
    thVerdict: "Hukm",
    thOpp: "Imkon.",
    thDemand: "Talab",
    thMarketMed: "Bozor medianasi",
    thLanded: "Yetkazilgan",
    thMargin: "Marja",
    thQty: "Soni",
    thAction: "Amal",
    noMarketData: " · bozor ma'lumotlari yo'q",
    demandTitle: (inq, watch, fav, search) =>
      `${inq} so'rov · ${watch} kuzatuv · ${fav} sevimli · ${search} qidiruv`,
    createPoTitle: "Xarid buyurtmasini yaratish",
    order: "buyurtma",
    footnote:
      "Imkoniyat talab (40%) va marjani (60%) birlashtiradi, bozor ma'lumotlari ishonchliligi bo'yicha masshtablanadi. Marja uchun kuzatiladigan yetkazib beruvchi tannarxi (xarid buyurtmasidan) va bozor e'lonlari kerak; ulardan birortasi yo'q modellar baribir faqat talab bo'yicha ko'rsatiladi. Model bo'yicha tavsiya etilgan sotuv narxi: import kalkulyatoriga qarang.",
    verdict: {
      strong_buy: "Qat'iy xarid",
      buy: "Xarid qilish",
      consider: "Ko'rib chiqish",
      skip: "O'tkazib yuborish",
    },
  },
  en: {
    title: "Buying brain",
    intro:
      "What to import next — demand × market price × landed cost, ranked by opportunity. Each row fuses your inquiries/watches/searches, OLX/Telegram medians, and the customs landed-cost engine.",
    emptyPrefix: "No recommendations yet — add market data (",
    emptyMarketIntel: "Market Intel",
    emptyMid: "), track supplier costs (",
    emptyProcurement: "Procurement",
    emptySuffix: "), and let demand accrue.",
    thModel: "Model",
    thVerdict: "Verdict",
    thOpp: "Opp.",
    thDemand: "Demand",
    thMarketMed: "Market med.",
    thLanded: "Landed",
    thMargin: "Margin",
    thQty: "Qty",
    thAction: "Action",
    noMarketData: " · no market data",
    demandTitle: (inq, watch, fav, search) =>
      `${inq} inq · ${watch} watch · ${fav} fav · ${search} search`,
    createPoTitle: "Create a purchase order",
    order: "order",
    footnote:
      "Opportunity blends demand (40%) and margin (60%), scaled by market-data confidence. Margin needs a tracked supplier cost (from a purchase order) and market listings; models missing either still show on demand alone. Suggested list price per model: see the import calculator.",
    verdict: {
      strong_buy: "Strong buy",
      buy: "Buy",
      consider: "Consider",
      skip: "Skip",
    },
  },
};

export default function AdminBuyingPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [rows, setRows] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/buying")
      .then((r) => r.json())
      .then((d) => setRows(d?.ok ? d.recommendations || [] : []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl">
      <div className="flex items-center gap-3 mb-1">
        <Target className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {t.intro}
      </p>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t.emptyPrefix}<Link href="/admin/market" className="text-primary hover:underline">{t.emptyMarketIntel}</Link>{t.emptyMid}<Link href="/admin/procurement" className="text-primary hover:underline">{t.emptyProcurement}</Link>{t.emptySuffix}
        </p>
      ) : (
        <div className="bg-card border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-3 py-2 font-medium">{t.thModel}</th>
                <th className="px-3 py-2 font-medium">{t.thVerdict}</th>
                <th className="px-3 py-2 font-medium text-right">{t.thOpp}</th>
                <th className="px-3 py-2 font-medium text-right">{t.thDemand}</th>
                <th className="px-3 py-2 font-medium text-right">{t.thMarketMed}</th>
                <th className="px-3 py-2 font-medium text-right">{t.thLanded}</th>
                <th className="px-3 py-2 font-medium text-right">{t.thMargin}</th>
                <th className="px-3 py-2 font-medium text-right">{t.thQty}</th>
                <th className="px-3 py-2 font-medium text-right">{t.thAction}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const verdictKey = VERDICT_TONE[r.verdict] ? r.verdict : "skip";
                const verdictTone = VERDICT_TONE[verdictKey];
                const verdictLabel = t.verdict[verdictKey];
                return (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5">
                      <div className="text-foreground">{r.brand} {r.model}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {r.fuel}{r.marketSample > 0 ? ` · n=${r.marketSample}${r.marketFreshnessDays != null ? ` · ${r.marketFreshnessDays}d` : ""}` : t.noMarketData}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 border rounded-[2px] ${verdictTone}`}>{verdictLabel}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-foreground">{r.opportunityScore}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground" title={t.demandTitle(r.demand.inquiries, r.demand.watches, r.demand.favorites, r.demand.savedSearches)}>
                      {r.demandScore}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-foreground">{usd(r.marketMedianUsd)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{usd(r.landedCostUsd)}</td>
                    <td className={`px-3 py-2.5 text-right font-mono ${r.marginPct == null ? "text-muted-foreground" : r.marginPct >= 10 ? "text-[var(--success)]" : r.marginPct < 5 ? "text-[var(--danger)]" : "text-foreground"}`}>
                      {r.marginUsd == null ? "—" : `${usd(r.marginUsd)}`}{r.marginPct != null ? <span className="text-[11px] opacity-70"> {r.marginPct > 0 ? "+" : ""}{r.marginPct}%</span> : null}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-foreground">{r.recommendedQty || ""}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {r.recommendedQty > 0 && (
                        <Link
                          href={`/admin/procurement?brand=${encodeURIComponent(r.brand)}&model=${encodeURIComponent(r.model)}${r.supplierCostUsd ? `&unit_cost_usd=${r.supplierCostUsd}` : ""}`}
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                          title={t.createPoTitle}
                        >
                          <Truck className="w-3 h-3" /> {t.order} {r.recommendedQty}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground mt-4">
        <TrendingUp className="w-3.5 h-3.5 mt-px shrink-0" />
        {t.footnote}
      </p>
    </div>
  );
}
