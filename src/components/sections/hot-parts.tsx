"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Wrench, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";
import { FadeInScroll } from "@/components/animations/fade-in";
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
  const t = LABELS[locale as keyof typeof LABELS] || LABELS.ru;

  if (parts.length === 0) return null;

  return (
    <section className="py-24 md:py-32 bg-background relative">
      <div className="container-custom relative z-10">
        <FadeInScroll direction="up">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 mb-16">
            <SectionHeading
              title={t.title}
              subtitle={t.subtitle}
              centered={false}
              className="mb-0 max-w-2xl"
            />
            <Button
              asChild
              variant="outline"
              size="lg"
              className="shrink-0 tracking-wide uppercase text-xs rounded-none border-foreground hover:bg-foreground hover:text-background transition-all"
            >
              <Link href={localizedPath(locale, "/parts")}>
                {t.viewAll} <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </FadeInScroll>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {parts.map((p, index) => {
            const inStock = (p.stock_qty ?? 0) > 0;
            const img = p.images?.[0];
            return (
              <FadeInScroll key={p.id} direction="up" delay={index * 0.1}>
                <Link
                  href={localizedPath(locale, `/parts/${p.slug}`)}
                  className="group block bg-card rounded-sm overflow-hidden border border-border transition-all duration-500 hover:shadow-lg hover:border-foreground/20"
                >
                  <div className="aspect-square bg-muted relative flex items-center justify-center overflow-hidden">
                    {img ? (
                      <Image
                        src={img}
                        alt={partName(p, locale)}
                        fill
                        sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                      />
                    ) : (
                      <Wrench className="w-12 h-12 text-muted-foreground/30" />
                    )}
                    <Badge
                      variant={inStock ? "default" : "secondary"}
                      className={cn(
                        "absolute top-3 left-3 text-[10px] tracking-wider uppercase rounded-none font-medium px-2 py-0.5",
                        inStock ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                      )}
                    >
                      <Package className="w-3 h-3 mr-1" />
                      {inStock ? t.inStock : t.outOfStock}
                    </Badge>
                  </div>
                  <div className="p-5">
                    <p className="font-medium text-base text-foreground line-clamp-2 mb-2 group-hover:text-foreground/80 transition-colors">
                      {partName(p, locale)}
                    </p>
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest truncate max-w-[50%]">
                        {p.oem_number ? `OEM ${p.oem_number}` : ""}
                      </p>
                      {p.price_usd != null && (
                        <p className="text-sm font-semibold text-foreground tracking-tight">
                          ${p.price_usd}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              </FadeInScroll>
            );
          })}
        </div>
      </div>
    </section>
  );
}
