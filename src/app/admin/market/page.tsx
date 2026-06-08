"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LineChart, Loader2, Sparkles, Save, Plus, Ship } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface ParsedListing {
  brand: string;
  model: string;
  year?: number | null;
  price_raw?: number | null;
  currency?: string | null;
  city?: string | null;
  condition?: string | null;
}

interface StatRow {
  brand: string;
  model: string;
  year: number | null;
  medianUsd: number | null;
  minUsd: number | null;
  maxUsd: number | null;
  count: number;
  latestObservedAt: string | null;
  ourPriceUsd: number | null;
  weSell: boolean;
  vsMarketPct: number | null;
}

const usd = (n: number | null) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));

const COPY: Record<Locale, {
  title: string;
  introPrefix: string;
  introListings: (count: number, days: number) => string;
  collectorFreshness: string;
  today: string;
  daysAgo: (d: number) => string;
  scrapersNote: string;
  addMarketData: string;
  sourceOlx: string;
  sourceTelegram: string;
  sourceManual: string;
  sourceOther: string;
  pastePlaceholder: string;
  parseWithAi: string;
  noListingsParsed: string;
  reviewSave: (count: number) => string;
  save: string;
  orAddManually: string;
  brand: string;
  model: string;
  year: string;
  price: string;
  add: string;
  saved: (count: number) => string;
  saveFailed: string;
  added1: string;
  noMarketDataYet: string;
  thModel: string;
  thMarketMedian: string;
  thRange: string;
  thYourPrice: string;
  thVsMarket: string;
  thN: string;
  thFresh: string;
  thProfit: string;
  newOpportunity: string;
  calcTitle: string;
  calc: string;
  tipPrefix: string;
  tipVsMarket: string;
  tipVsMarketBody: string;
  tipNewOpportunity: string;
  tipNewOpportunityBody: string;
  tipCalc: string;
  tipCalcBody: string;
}> = {
  ru: {
    title: "Рыночная аналитика",
    introPrefix:
      "За сколько машины реально продаются на OLX и в Telegram — чтобы вы котировали конкурентно и импортировали модели с лучшей рыночной ценой относительно стоимости с доставкой. ",
    introListings: (count, days) => `${count} объявлений (за последние ${days}д).`,
    collectorFreshness: "Свежесть сборщика: ",
    today: "сегодня",
    daysAgo: (d) => `${d}д назад`,
    scrapersNote: "скраперы запускаются из deploy/collector/",
    addMarketData: "Добавить рыночные данные",
    sourceOlx: "OLX",
    sourceTelegram: "Telegram",
    sourceManual: "Вручную",
    sourceOther: "Другое",
    pastePlaceholder:
      "Вставьте сырые результаты поиска OLX или дамп Telegram-канала — ИИ извлечёт марку / модель / год / цену для вашей проверки.",
    parseWithAi: "Разобрать с ИИ",
    noListingsParsed: "Объявления не распознаны. Добавьте строки вручную ниже или проверьте, что LLM_API_KEY задан.",
    reviewSave: (count) => `Проверить и сохранить (выбрано ${count}):`,
    save: "Сохранить",
    orAddManually: "…или добавьте одно вручную:",
    brand: "Марка",
    model: "Модель",
    year: "Год",
    price: "Цена",
    add: "Добавить",
    saved: (count) => `Сохранено ${count} объявл.`,
    saveFailed: "Не удалось сохранить.",
    added1: "Добавлено 1 объявление.",
    noMarketDataYet: "Пока нет рыночных данных — добавьте выше.",
    thModel: "Модель",
    thMarketMedian: "Медиана рынка",
    thRange: "Диапазон",
    thYourPrice: "Ваша цена",
    thVsMarket: "vs рынок",
    thN: "n",
    thFresh: "Свеж.",
    thProfit: "Прибыль?",
    newOpportunity: "новая возможность",
    calcTitle: "Проверить маржу импорта по этой рыночной цене",
    calc: "расчёт",
    tipPrefix: "Подсказка: ",
    tipVsMarket: "vs рынок",
    tipVsMarketBody:
      " показывает, как ваша цена соотносится с медианой — зелёный означает, что вы ниже рынка (конкурентно), красный — выше. ",
    tipNewOpportunity: "новая возможность",
    tipNewOpportunityBody: " = хорошо продающаяся модель, которую вы пока не предлагаете. Используйте ",
    tipCalc: "расчёт",
    tipCalcBody: ", чтобы увидеть маржу импорта по рыночной цене.",
  },
  uz: {
    title: "Bozor tahlili",
    introPrefix:
      "Mashinalar OLX va Telegramda aslida qanchaga sotiladi — siz raqobatbardosh narx taklif qilishingiz va yetkazib berish tannarxiga nisbatan eng yaxshi bozor narxiga ega modellarni import qilishingiz uchun. ",
    introListings: (count, days) => `${count} ta e'lon (oxirgi ${days} kun).`,
    collectorFreshness: "Yig'uvchi yangiligi: ",
    today: "bugun",
    daysAgo: (d) => `${d} kun oldin`,
    scrapersNote: "skraperlar deploy/collector/ dan ishga tushadi",
    addMarketData: "Bozor ma'lumotlarini qo'shish",
    sourceOlx: "OLX",
    sourceTelegram: "Telegram",
    sourceManual: "Qo'lda",
    sourceOther: "Boshqa",
    pastePlaceholder:
      "OLX qidiruv natijalarini yoki Telegram kanal dumpini joylashtiring — AI siz ko'rib chiqishingiz uchun marka / model / yil / narxni ajratib oladi.",
    parseWithAi: "AI bilan tahlil qilish",
    noListingsParsed: "Hech qanday e'lon tahlil qilinmadi. Quyida qatorlarni qo'lda qo'shing yoki LLM_API_KEY o'rnatilganini tekshiring.",
    reviewSave: (count) => `Ko'rib chiqish va saqlash (${count} tanlangan):`,
    save: "Saqlash",
    orAddManually: "…yoki bittasini qo'lda qo'shing:",
    brand: "Marka",
    model: "Model",
    year: "Yil",
    price: "Narx",
    add: "Qo'shish",
    saved: (count) => `${count} ta e'lon saqlandi.`,
    saveFailed: "Saqlash amalga oshmadi.",
    added1: "1 ta e'lon qo'shildi.",
    noMarketDataYet: "Hozircha bozor ma'lumotlari yo'q — yuqorida qo'shing.",
    thModel: "Model",
    thMarketMedian: "Bozor medianasi",
    thRange: "Diapazon",
    thYourPrice: "Sizning narxingiz",
    thVsMarket: "bozorga nisbatan",
    thN: "n",
    thFresh: "Yangi",
    thProfit: "Foyda?",
    newOpportunity: "yangi imkoniyat",
    calcTitle: "Ushbu bozor narxida import marjasini tekshirish",
    calc: "hisob",
    tipPrefix: "Maslahat: ",
    tipVsMarket: "bozorga nisbatan",
    tipVsMarketBody:
      " sizning narxingiz medianaga qanday nisbatda ekanini ko'rsatadi — yashil siz bozordan past (raqobatbardosh), qizil yuqori ekanini bildiradi. ",
    tipNewOpportunity: "yangi imkoniyat",
    tipNewOpportunityBody: " = yaxshi sotilayotgan, lekin siz hali taklif qilmaydigan model. ",
    tipCalc: "hisob",
    tipCalcBody: " orqali bozor narxida import marjangizni ko'ring.",
  },
  en: {
    title: "Market intelligence",
    introPrefix:
      "What cars actually sell for on OLX & Telegram — so you quote competitively and import the models with the best market price vs landed cost. ",
    introListings: (count, days) => `${count} listings (last ${days}d).`,
    collectorFreshness: "Collector freshness: ",
    today: "today",
    daysAgo: (d) => `${d}d ago`,
    scrapersNote: "scrapers run from deploy/collector/",
    addMarketData: "Add market data",
    sourceOlx: "OLX",
    sourceTelegram: "Telegram",
    sourceManual: "Manual",
    sourceOther: "Other",
    pastePlaceholder:
      "Paste raw OLX search results or a Telegram channel dump — the AI will extract brand / model / year / price for you to review.",
    parseWithAi: "Parse with AI",
    noListingsParsed: "No listings parsed. Add rows manually below, or check LLM_API_KEY is set.",
    reviewSave: (count) => `Review & save (${count} selected):`,
    save: "Save",
    orAddManually: "…or add one manually:",
    brand: "Brand",
    model: "Model",
    year: "Year",
    price: "Price",
    add: "Add",
    saved: (count) => `Saved ${count} listing${count === 1 ? "" : "s"}.`,
    saveFailed: "Save failed.",
    added1: "Added 1 listing.",
    noMarketDataYet: "No market data yet — add some above.",
    thModel: "Model",
    thMarketMedian: "Market median",
    thRange: "Range",
    thYourPrice: "Your price",
    thVsMarket: "vs market",
    thN: "n",
    thFresh: "Fresh",
    thProfit: "Profit?",
    newOpportunity: "new opportunity",
    calcTitle: "Check import margin at this market price",
    calc: "calc",
    tipPrefix: "Tip: ",
    tipVsMarket: "vs market",
    tipVsMarketBody:
      " shows how your price compares to the median — green means you're below market (competitive), red means above. ",
    tipNewOpportunity: "New opportunity",
    tipNewOpportunityBody: " = a model selling well that you don't list yet. Use ",
    tipCalc: "calc",
    tipCalcBody: " to see your import margin at the market price.",
  },
};

export default function AdminMarketPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const ago = (s: string | null) => {
    if (!s) return "—";
    const d = Math.floor((Date.now() - new Date(s).getTime()) / 86_400_000);
    return d <= 0 ? t.today : t.daysAgo(d);
  };
  const [rows, setRows] = useState<StatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<{ totalListings: number; windowDays: number; sources?: Record<string, { count: number; latest: string | null }> }>({ totalListings: 0, windowDays: 90 });

  const [source, setSource] = useState<"olx" | "telegram" | "manual" | "other">("olx");
  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedListing[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // manual single add
  const [m, setM] = useState({ brand: "", model: "", year: "", price: "", currency: "USD" });

  const loadStats = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/market/stats")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) {
          setRows(d.rows || []);
          setMeta({ totalListings: d.totalListings || 0, windowDays: d.windowDays || 90, sources: d.sources });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const parse = async () => {
    if (rawText.trim().length < 4) return;
    setParsing(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/market/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });
      const d = await res.json();
      const list: ParsedListing[] = Array.isArray(d.listings) ? d.listings : [];
      setParsed(list);
      setSelected(new Set(list.map((_, i) => i)));
      if (list.length === 0) setNote(t.noListingsParsed);
    } finally {
      setParsing(false);
    }
  };

  const saveParsed = async () => {
    const listings = parsed.filter((_, i) => selected.has(i));
    if (listings.length === 0) return;
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/market/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, listings }),
      });
      const d = await res.json();
      if (res.ok) {
        setNote(t.saved(d.stored));
        setParsed([]);
        setRawText("");
        loadStats();
      } else {
        setNote(d.error || t.saveFailed);
      }
    } finally {
      setSaving(false);
    }
  };

  const addManual = async () => {
    if (!m.brand.trim() || !m.model.trim() || !m.price) return;
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/market/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "manual",
          listings: [{
            brand: m.brand.trim(),
            model: m.model.trim(),
            year: m.year ? Number(m.year) : null,
            price_raw: Number(m.price),
            currency: m.currency,
          }],
        }),
      });
      if (res.ok) {
        setNote(t.added1);
        setM({ brand: "", model: "", year: "", price: "", currency: "USD" });
        loadStats();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <LineChart className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-1.5">
        {t.introPrefix}{t.introListings(meta.totalListings, meta.windowDays)}
      </p>
      {meta.sources && Object.keys(meta.sources).length > 0 && (
        <p className="text-[11px] text-muted-foreground mb-6">
          {t.collectorFreshness}
          {(["olx", "telegram", "manual", "other"] as const)
            .filter((s) => meta.sources?.[s])
            .map((s) => {
              const v = meta.sources![s];
              const ageDays = v.latest ? Math.floor((Date.now() - new Date(v.latest).getTime()) / 86_400_000) : null;
              const stale = ageDays != null && (s === "olx" || s === "telegram") && ageDays > 7;
              return (
                <span key={s} className={stale ? "text-[var(--warning)]" : undefined}>
                  {s.toUpperCase()} {v.count}{ageDays != null ? ` (${ageDays === 0 ? t.today : t.daysAgo(ageDays)})` : ""}
                  {stale ? " ⚠" : ""}
                  {" · "}
                </span>
              );
            })}
          <span className="text-muted-foreground/70">{t.scrapersNote}</span>
        </p>
      )}

      {/* Add market data */}
      <div className="bg-card border border-border p-4 mb-8 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">{t.addMarketData}</h2>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as typeof source)}
            className="h-9 rounded-[2px] border border-border bg-[var(--bg-3)] px-2 text-sm text-foreground"
          >
            <option value="olx">{t.sourceOlx}</option>
            <option value="telegram">{t.sourceTelegram}</option>
            <option value="manual">{t.sourceManual}</option>
            <option value="other">{t.sourceOther}</option>
          </select>
        </div>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={t.pastePlaceholder}
          rows={4}
          className="w-full rounded-[2px] border border-border bg-[var(--bg-3)] px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--accent)]"
        />
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={parse} disabled={parsing || rawText.trim().length < 4}>
            {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> {t.parseWithAi}</>}
          </Button>
        </div>

        {parsed.length > 0 && (
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs text-muted-foreground">{t.reviewSave(selected.size)}</p>
            <div className="max-h-56 overflow-y-auto space-y-1">
              {parsed.map((p, i) => (
                <label key={i} className="flex items-center gap-2 text-sm py-1">
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() =>
                      setSelected((s) => {
                        const n = new Set(s);
                        if (n.has(i)) n.delete(i); else n.add(i);
                        return n;
                      })
                    }
                  />
                  <span className="text-foreground">{p.brand} {p.model}{p.year ? ` ${p.year}` : ""}</span>
                  <span className="font-mono text-muted-foreground">
                    {p.price_raw ? `${p.price_raw.toLocaleString()} ${p.currency || ""}` : "—"}
                  </span>
                  {p.city && <span className="text-[11px] text-muted-foreground">· {p.city}</span>}
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={saveParsed} disabled={saving || selected.size === 0}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> {t.save} {selected.size}</>}
              </Button>
            </div>
          </div>
        )}

        {/* Manual single add */}
        <div className="border-t border-border pt-3">
          <p className="text-xs text-muted-foreground mb-2">{t.orAddManually}</p>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            <Input placeholder={t.brand} value={m.brand} onChange={(e) => setM({ ...m, brand: e.target.value })} className="text-sm" />
            <Input placeholder={t.model} value={m.model} onChange={(e) => setM({ ...m, model: e.target.value })} className="text-sm" />
            <Input placeholder={t.year} type="number" value={m.year} onChange={(e) => setM({ ...m, year: e.target.value })} className="text-sm" />
            <Input placeholder={t.price} type="number" value={m.price} onChange={(e) => setM({ ...m, price: e.target.value })} className="text-sm" />
            <select value={m.currency} onChange={(e) => setM({ ...m, currency: e.target.value })} className="h-11 rounded-[2px] border border-border bg-[var(--bg-3)] px-2 text-sm text-foreground">
              <option value="USD">USD</option>
              <option value="UZS">UZS</option>
            </select>
            <Button type="button" variant="outline" size="sm" onClick={addManual} disabled={saving || !m.brand || !m.model || !m.price}>
              <Plus className="w-4 h-4" /> {t.add}
            </Button>
          </div>
        </div>

        {note && <p className="text-xs text-primary">{note}</p>}
      </div>

      {/* Intelligence table */}
      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.noMarketDataYet}</p>
      ) : (
        <div className="bg-card border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-4 py-2 font-medium">{t.thModel}</th>
                <th className="px-4 py-2 font-medium text-right">{t.thMarketMedian}</th>
                <th className="px-4 py-2 font-medium text-right">{t.thRange}</th>
                <th className="px-4 py-2 font-medium text-right">{t.thYourPrice}</th>
                <th className="px-4 py-2 font-medium text-right">{t.thVsMarket}</th>
                <th className="px-4 py-2 font-medium text-right">{t.thN}</th>
                <th className="px-4 py-2 font-medium">{t.thFresh}</th>
                <th className="px-4 py-2 font-medium text-right">{t.thProfit}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-foreground">
                    {r.brand} {r.model}{r.year ? ` ${r.year}` : ""}
                    {!r.weSell && <span className="ml-2 text-[10px] font-mono uppercase text-[var(--info)]">{t.newOpportunity}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground">{usd(r.medianUsd)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[11px] text-muted-foreground">{usd(r.minUsd)}–{usd(r.maxUsd)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{usd(r.ourPriceUsd)}</td>
                  <td className={`px-4 py-2.5 text-right font-mono ${r.vsMarketPct == null ? "text-muted-foreground" : r.vsMarketPct > 3 ? "text-[var(--danger)]" : r.vsMarketPct < -3 ? "text-[var(--success)]" : "text-foreground"}`}>
                    {r.vsMarketPct == null ? "—" : `${r.vsMarketPct > 0 ? "+" : ""}${r.vsMarketPct}%`}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{r.count}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{ago(r.latestObservedAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/admin/import-calculator?market=${r.medianUsd ?? ""}&brand=${encodeURIComponent(r.brand)}&model=${encodeURIComponent(r.model)}${r.year ? `&year=${r.year}` : ""}`}
                      className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                      title={t.calcTitle}
                    >
                      <Ship className="w-3 h-3" /> {t.calc}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-4">
        {t.tipPrefix}<span className="text-foreground">{t.tipVsMarket}</span>{t.tipVsMarketBody}<span className="text-foreground">{t.tipNewOpportunity}</span>{t.tipNewOpportunityBody}<span className="text-foreground">{t.tipCalc}</span>{t.tipCalcBody}
      </p>
    </div>
  );
}
