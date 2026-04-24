"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Wrench, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { GridBackground } from "@/components/effects";
import { cn } from "@/lib/utils";

export type HotPart = {
  id: string;
  slug: string;
  name_ru: string;
  name_uz: string | null;
  name_en: string | null;
  oem_number: string | null;
  images: string[];
  stock_qty: number;
  price_usd: number | null;
};

interface HotPartsProps {
  parts: HotPart[];
}

const LABELS = {
  ru: {
    title: "Запчасти в наличии",
    subtitle: "OEM и аналоги для популярных китайских моделей",
    viewAll: "Весь каталог",
    inStock: "В наличии",
    outOfStock: "Под заказ",
    details: "Подробнее",
  },
  uz: {
    title: "Mavjud ehtiyot qismlar",
    subtitle: "Mashhur xitoy modellari uchun OEM va analog qismlar",
    viewAll: "To'liq katalog",
    inStock: "Mavjud",
    outOfStock: "Buyurtma asosida",
    details: "Batafsil",
  },
  en: {
    title: "Parts in Stock",
    subtitle: "OEM and aftermarket for popular Chinese models",
    viewAll: "Full catalog",
    inStock: "In stock",
    outOfStock: "Made to order",
    details: "Details",
  },
} as const;

function partName(p: HotPart, locale: "ru" | "uz" | "en"): string {
  if (locale === "uz" && p.name_uz) return p.name_uz;
  if (locale === "en" && p.name_en) return p.name_en;
  return p.name_ru;
}

export function HotParts({ parts }: HotPartsProps) {
  const { locale } = useLocale();
  const { ref, isVisible } = useScrollReveal();
  const t = LABELS[locale as keyof typeof LABELS] || LABELS.ru;

  if (parts.length === 0) return null;

  return (
    <section className="py-20 md:py-28 bg-[#0b0b12] relative overflow-hidden">
      <GridBackground />
      <div className="absolute top-0 right-1/4 w-72 h-72 bg-neon-cyan/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-neon-purple/5 rounded-full blur-3xl" />

      <div className="container-custom relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-12">
          <SectionHeading
            title={t.title}
            subtitle={t.subtitle}
            centered={false}
            className="mb-0"
            light
          />
          <Button asChild variant="outline" className="rounded-xl">
            <Link href={localizedPath(locale, "/parts")} className="gap-2">
              {t.viewAll} <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>

        <div
          ref={ref}
          className={cn(
            "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 transition-all duration-700",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
          )}
        >
          {parts.map((p) => {
            const inStock = (p.stock_qty ?? 0) > 0;
            const img = p.images?.[0];
            return (
              <Link
                key={p.id}
                href={localizedPath(locale, `/parts/${p.slug}`)}
                className="group rounded-2xl border border-white/10 bg-[#0d0d15] overflow-hidden hover:border-white/20 transition-colors"
              >
                <div className="aspect-square bg-white/[0.03] relative flex items-center justify-center">
                  {img ? (
                    <Image
                      src={img}
                      alt={partName(p, locale)}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <Wrench className="w-10 h-10 text-white/20" />
                  )}
                  <Badge
                    variant={inStock ? "success" : "secondary"}
                    className="absolute top-2 left-2 text-[10px]"
                  >
                    <Package className="w-3 h-3 mr-1" />
                    {inStock ? t.inStock : t.outOfStock}
                  </Badge>
                </div>
                <div className="p-4">
                  <p className="font-medium text-sm text-white line-clamp-2 mb-1">
                    {partName(p, locale)}
                  </p>
                  {p.oem_number && (
                    <p className="text-xs text-white/40 font-mono truncate">
                      OEM {p.oem_number}
                    </p>
                  )}
                  {p.price_usd != null && (
                    <p className="text-sm text-white/80 mt-2 font-semibold">
                      ${p.price_usd}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
