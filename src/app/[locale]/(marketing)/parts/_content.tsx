"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, Wrench, Loader2, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { CAR_BRANDS } from "@/lib/constants";
import { localizedPath } from "@/lib/locale-path";
import { PART_CATEGORIES } from "@/lib/schemas/part";
import { cn } from "@/lib/utils";
import type { Part } from "@/types/part";

const LABELS = {
  ru: {
    title: "Каталог запчастей",
    subtitle: "OEM и аналоговые запчасти для китайских авто",
    search: "Поиск по названию, OEM номеру, бренду...",
    allCategories: "Все категории",
    allBrands: "Все марки",
    noResults: "Запчасти не найдены",
    inStock: "В наличии",
    outOfStock: "Под заказ",
    details: "Подробнее",
    categories: {
      engine: "Двигатель",
      body: "Кузов",
      electrical: "Электрика",
      suspension: "Подвеска",
      brakes: "Тормоза",
      interior: "Салон",
      other: "Прочее",
    },
  },
  uz: {
    title: "Ehtiyot qismlar katalogi",
    subtitle: "Xitoy avtomobillari uchun OEM va analog qismlar",
    search: "Nom, OEM raqami, brend bo'yicha qidiring...",
    allCategories: "Barcha kategoriyalar",
    allBrands: "Barcha brendlar",
    noResults: "Qismlar topilmadi",
    inStock: "Mavjud",
    outOfStock: "Buyurtma asosida",
    details: "Batafsil",
    categories: {
      engine: "Dvigatel",
      body: "Kuzov",
      electrical: "Elektrika",
      suspension: "Podveska",
      brakes: "Tormoz",
      interior: "Salon",
      other: "Boshqa",
    },
  },
  en: {
    title: "Spare Parts Catalog",
    subtitle: "OEM and aftermarket parts for Chinese cars",
    search: "Search by name, OEM number, brand...",
    allCategories: "All categories",
    allBrands: "All brands",
    noResults: "No parts found",
    inStock: "In stock",
    outOfStock: "Made to order",
    details: "Details",
    categories: {
      engine: "Engine",
      body: "Body",
      electrical: "Electrical",
      suspension: "Suspension",
      brakes: "Brakes",
      interior: "Interior",
      other: "Other",
    },
  },
} as const;

function partName(p: Part, locale: "ru" | "uz" | "en"): string {
  if (locale === "uz" && p.name_uz) return p.name_uz;
  if (locale === "en" && p.name_en) return p.name_en;
  return p.name_ru;
}

export default function PartsCatalogContent({
  initialCategory,
}: { initialCategory?: string } = {}) {
  const { locale } = useLocale();
  const t = LABELS[locale as keyof typeof LABELS] || LABELS.ru;
  const qp = useSearchParams();

  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(initialCategory ?? (qp?.get("category") ?? ""));
  const [fitsBrand, setFitsBrand] = useState(qp?.get("fits_brand") ?? "");
  const [fitsModel, setFitsModel] = useState(qp?.get("fits_model") ?? "");
  const [year, setYear] = useState(qp?.get("year") ?? "");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 12;

  const fetchParts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (category) params.set("category", category);
      if (fitsBrand) params.set("fits_brand", fitsBrand);
      if (fitsModel) params.set("fits_model", fitsModel);
      if (year) params.set("year", year);
      params.set("page", String(page));
      params.set("page_size", String(pageSize));

      const res = await fetch(`/api/parts?${params.toString()}`);
      const data = await res.json();
      setParts(data.parts || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [search, category, fitsBrand, fitsModel, year, page]);

  useEffect(() => {
    const h = setTimeout(fetchParts, search ? 300 : 0);
    return () => clearTimeout(h);
  }, [fetchParts, search]);

  useEffect(() => {
    setPage(1);
  }, [search, category, fitsBrand, fitsModel, year]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading as="h1" title={t.title} subtitle={t.subtitle} />

        {(fitsModel || year) && (
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-cyan-400/10 border border-cyan-400/30 px-4 py-2 text-sm text-cyan-200">
            <Package className="w-4 h-4" />
            <span>
              {locale === "uz"
                ? "Filtrlangan: "
                : locale === "en"
                ? "Filtered for: "
                : "Фильтр: "}
              <b>{[fitsBrand, fitsModel, year].filter(Boolean).join(" · ")}</b>
            </span>
            <button
              type="button"
              onClick={() => {
                setFitsBrand("");
                setFitsModel("");
                setYear("");
              }}
              className="ml-2 text-cyan-300/70 hover:text-white underline"
            >
              {locale === "uz" ? "tozalash" : locale === "en" ? "clear" : "сбросить"}
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search}
              className="pl-12 h-12 rounded-xl"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-4 h-12 rounded-xl bg-[#0a0a0f] border border-white/10 text-sm text-white"
          >
            <option value="">{t.allCategories}</option>
            {PART_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t.categories[c as keyof typeof t.categories]}
              </option>
            ))}
          </select>
          <select
            value={fitsBrand}
            onChange={(e) => setFitsBrand(e.target.value)}
            className="px-4 h-12 rounded-xl bg-[#0a0a0f] border border-white/10 text-sm text-white"
          >
            <option value="">{t.allBrands}</option>
            {CAR_BRANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-white/40">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> ...
          </div>
        ) : parts.length === 0 ? (
          <div className="text-center py-20 bg-[#0a0a0f] rounded-2xl border border-white/10">
            <Package className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/60">{t.noResults}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {parts.map((p) => (
              <Link
                key={p.id}
                href={localizedPath(locale, `/parts/${p.slug}`)}
                className="group bg-[#0d0d15] rounded-2xl border border-white/10 overflow-hidden hover:border-cyan-400/40 transition-all"
              >
                <div className="aspect-video bg-[#050508] relative overflow-hidden">
                  {p.images[0] ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.images[0]}
                      alt={partName(p, locale as "ru" | "uz" | "en")}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20">
                      <Wrench className="w-10 h-10" />
                    </div>
                  )}
                  <Badge
                    variant="secondary"
                    className="absolute top-2 left-2 capitalize text-[10px]"
                  >
                    {t.categories[p.category as keyof typeof t.categories] || p.category}
                  </Badge>
                </div>
                <div className="p-4 space-y-2">
                  <p className="font-semibold text-white truncate">
                    {partName(p, locale as "ru" | "uz" | "en")}
                  </p>
                  {p.oem_number && (
                    <p className="text-xs text-white/40 font-mono truncate">OEM: {p.oem_number}</p>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-lg font-bold text-white">
                      {p.price_usd ? `$${p.price_usd}` : "—"}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        p.stock_qty > 0 ? "text-green-400" : "text-white/40",
                      )}
                    >
                      {p.stock_qty > 0 ? t.inStock : t.outOfStock}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              ←
            </Button>
            <span className="text-sm text-white/60">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
