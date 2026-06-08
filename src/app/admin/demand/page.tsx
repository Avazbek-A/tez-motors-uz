"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Heart, Bell, MessageSquare, Loader2, Flame, PackagePlus, Truck } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface HotCar {
  car_id: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  price_usd: number | null;
  inventory_status: string | null;
  slug: string | null;
  favorites: number;
  watches: number;
  inquiries: number;
  minTarget: number | null;
  score: number;
}

interface DemandData {
  totals: { favorites: number; watches: number; inquiries: number; savedSearches: number };
  hotCars: HotCar[];
  byBrand: { brand: string; score: number; cars: number }[];
  wantedBrands: { brand: string; count: number }[];
}

const usd = (n: number | null) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));

const STATUS_TONE: Record<string, string> = {
  available: "text-[var(--success)]",
  reserved: "text-[var(--warning)]",
  sold: "text-muted-foreground",
};

const COPY: Record<Locale, {
  title: string;
  introLine1: string;
  introScore: string;
  noData: string;
  favorites: string;
  activeWatches: string;
  carInquiries: string;
  savedSearches: string;
  hottestInventory: string;
  noSignals: string;
  thCar: string;
  thPrice: string;
  thFav: string;
  thWatch: string;
  thInq: string;
  thMinTarget: string;
  thScore: string;
  thSource: string;
  modelLinkTitle: string;
  modelLink: string;
  procureLinkTitle: string;
  procureLink: string;
  demandByBrand: string;
  noDataShort: string;
  wantedBrands: string;
  noSavedSearchFilters: string;
}> = {
  ru: {
    title: "Аналитика спроса",
    introLine1:
      "Что хотят покупатели, ранжировано по реальным сигналам — избранное, отслеживание цен и запросы. Используйте, чтобы решить, какие машины закупать больше. Оценка взвешивает намерение: ",
    introScore: "запрос ×5 > отслеживание ×3 > избранное ×1.",
    noData: "Пока нет данных о спросе.",
    favorites: "Избранное",
    activeWatches: "Активные отслеживания",
    carInquiries: "Запросы по машинам",
    savedSearches: "Сохранённые поиски",
    hottestInventory: "Самые горячие позиции",
    noSignals: "Пока нет сигналов.",
    thCar: "Машина",
    thPrice: "Цена",
    thFav: "★ Избр.",
    thWatch: "Отсл.",
    thInq: "Запр.",
    thMinTarget: "Мин. цель",
    thScore: "Оценка",
    thSource: "Источник",
    modelLinkTitle: "Создать заказываемую предзаказную модель из этой машины",
    modelLink: "Модель",
    procureLinkTitle: "Открыть черновик заказа на закупку у поставщика для этой машины",
    procureLink: "Закупить",
    demandByBrand: "Спрос по маркам (в наличии)",
    noDataShort: "Нет данных.",
    wantedBrands: "Желаемые марки (сохранённые поиски)",
    noSavedSearchFilters: "Пока нет фильтров марок в сохранённых поисках.",
  },
  uz: {
    title: "Talab tahlili",
    introLine1:
      "Xaridorlar nimani xohlaydi, real signallar bo'yicha tartiblangan — sevimlilar, narx kuzatuvlari va so'rovlar. Qaysi mashinalarni ko'proq sotib olishni hal qilish uchun foydalaning. Ball niyatni tortadi: ",
    introScore: "so'rov ×5 > kuzatuv ×3 > sevimli ×1.",
    noData: "Hozircha talab ma'lumotlari yo'q.",
    favorites: "Sevimlilar",
    activeWatches: "Faol kuzatuvlar",
    carInquiries: "Mashina so'rovlari",
    savedSearches: "Saqlangan qidiruvlar",
    hottestInventory: "Eng qizg'in zaxira",
    noSignals: "Hozircha signallar yo'q.",
    thCar: "Mashina",
    thPrice: "Narx",
    thFav: "★ Sev.",
    thWatch: "Kuzatuv",
    thInq: "So'rov",
    thMinTarget: "Min. maqsad",
    thScore: "Ball",
    thSource: "Manba",
    modelLinkTitle: "Ushbu mashinadan buyurtma qilinadigan oldindan buyurtma modelini yaratish",
    modelLink: "Model",
    procureLinkTitle: "Ushbu mashina uchun yetkazib beruvchiga xarid buyurtmasi qoralamasini ochish",
    procureLink: "Sotib olish",
    demandByBrand: "Marka bo'yicha talab (mavjud)",
    noDataShort: "Ma'lumot yo'q.",
    wantedBrands: "Talab qilinadigan markalar (saqlangan qidiruvlar)",
    noSavedSearchFilters: "Hozircha saqlangan qidiruvlarda marka filtrlari yo'q.",
  },
  en: {
    title: "Demand intelligence",
    introLine1:
      "What buyers want, ranked from real signals — favorites, price-watches and inquiries. Use it to decide which cars to source more of. Score weights intent: ",
    introScore: "inquiry ×5 > watch ×3 > favorite ×1.",
    noData: "No demand data yet.",
    favorites: "Favorites",
    activeWatches: "Active watches",
    carInquiries: "Car inquiries",
    savedSearches: "Saved searches",
    hottestInventory: "Hottest inventory",
    noSignals: "No signals yet.",
    thCar: "Car",
    thPrice: "Price",
    thFav: "★ Fav",
    thWatch: "Watch",
    thInq: "Inq",
    thMinTarget: "Min target",
    thScore: "Score",
    thSource: "Source",
    modelLinkTitle: "Create an orderable pre-order model from this car",
    modelLink: "Model",
    procureLinkTitle: "Open a draft purchase order to a supplier for this car",
    procureLink: "Procure",
    demandByBrand: "Demand by brand (in stock)",
    noDataShort: "No data.",
    wantedBrands: "Wanted brands (saved searches)",
    noSavedSearchFilters: "No saved-search brand filters yet.",
  },
};

export default function AdminDemandPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [data, setData] = useState<DemandData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats/demand")
      .then((r) => r.json())
      .then((d) => setData(d && d.ok ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <TrendingUp className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {t.introLine1}{t.introScore}
      </p>

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
        </div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">{t.noData}</p>
      ) : (
        <div className="space-y-8">
          {/* Totals */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Heart, label: t.favorites, value: data.totals.favorites },
              { icon: Bell, label: t.activeWatches, value: data.totals.watches },
              { icon: MessageSquare, label: t.carInquiries, value: data.totals.inquiries },
              { icon: TrendingUp, label: t.savedSearches, value: data.totals.savedSearches },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border p-4">
                <s.icon className="w-4 h-4 text-primary mb-2" />
                <p className="font-mono text-2xl font-semibold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Hot cars */}
          <div className="bg-card border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Flame className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground">{t.hottestInventory}</h2>
            </div>
            {data.hotCars.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">{t.noSignals}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="px-4 py-2 font-medium">{t.thCar}</th>
                    <th className="px-4 py-2 font-medium text-right">{t.thPrice}</th>
                    <th className="px-4 py-2 font-medium text-right">{t.thFav}</th>
                    <th className="px-4 py-2 font-medium text-right">{t.thWatch}</th>
                    <th className="px-4 py-2 font-medium text-right">{t.thInq}</th>
                    <th className="px-4 py-2 font-medium text-right">{t.thMinTarget}</th>
                    <th className="px-4 py-2 font-medium text-right">{t.thScore}</th>
                    <th className="px-4 py-2 font-medium text-right">{t.thSource}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.hotCars.map((c) => (
                    <tr key={c.car_id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="text-foreground">{c.brand} {c.model}</span>
                        {c.year ? <span className="text-muted-foreground"> {c.year}</span> : null}
                        {c.inventory_status && (
                          <span className={`ml-2 text-xs font-mono uppercase ${STATUS_TONE[c.inventory_status] || "text-muted-foreground"}`}>
                            {c.inventory_status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-foreground">{usd(c.price_usd)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{c.favorites}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{c.watches}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{c.inquiries}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{usd(c.minTarget)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-primary">{c.score}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-3 justify-end">
                          <Link
                            href={`/admin/models?brand=${encodeURIComponent(c.brand || "")}&model=${encodeURIComponent(c.model || "")}${c.year ? `&year=${c.year}` : ""}${c.price_usd ? `&base_price_usd=${c.price_usd}` : ""}`}
                            title={t.modelLinkTitle}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <PackagePlus className="w-3.5 h-3.5" /> {t.modelLink}
                          </Link>
                          <Link
                            href={`/admin/procurement?brand=${encodeURIComponent(c.brand || "")}&model=${encodeURIComponent(c.model || "")}`}
                            title={t.procureLinkTitle}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                          >
                            <Truck className="w-3.5 h-3.5" /> {t.procureLink}
                          </Link>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Brand-level + wanted */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card border border-border p-4">
              <h2 className="font-semibold text-foreground mb-3">{t.demandByBrand}</h2>
              {data.byBrand.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.noDataShort}</p>
              ) : (
                <div className="space-y-2">
                  {data.byBrand.map((b) => (
                    <div key={b.brand} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{b.brand} <span className="text-muted-foreground text-xs">({b.cars})</span></span>
                      <span className="font-mono text-primary">{b.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-card border border-border p-4">
              <h2 className="font-semibold text-foreground mb-3">{t.wantedBrands}</h2>
              {data.wantedBrands.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.noSavedSearchFilters}</p>
              ) : (
                <div className="space-y-2">
                  {data.wantedBrands.map((b) => (
                    <div key={b.brand} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{b.brand}</span>
                      <span className="font-mono text-muted-foreground">{b.count}×</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
