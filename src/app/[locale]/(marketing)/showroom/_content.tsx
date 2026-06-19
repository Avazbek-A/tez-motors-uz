"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Box, Sparkles } from "lucide-react";
import { SectionHeading } from "@/components/shared/section-heading";
import { TradeInForm } from "@/components/trade-in/trade-in-form";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";
import type { Locale } from "@/i18n/config";

// AutoHome pano loads from China — keep it out of SSR and click-to-load (same
// as the car detail page) so it never blocks the portal's first paint.
const Car360 = dynamic(() => import("@/components/car/car-360").then((m) => m.Car360), { ssr: false });

export interface ShowroomCar {
  slug: string;
  brand: string;
  model: string;
  year: number;
  priceUsd: number;
  poster?: string;
  panoId: string;
}

const COPY: Record<Locale, {
  title: string; subtitle: string;
  inspectorTitle: string; chooseCar: string; viewDetails: string; from: string;
  noCars: string; browseCatalog: string;
  tradeInTitle: string; tradeInSubtitle: string;
}> = {
  ru: {
    title: "Виртуальный шоурум",
    subtitle: "Осмотрите авто в 360° и получите оценку трейд-ина — не выходя из дома.",
    inspectorTitle: "360° осмотр",
    chooseCar: "Выберите авто",
    viewDetails: "Подробнее об авто",
    from: "от",
    noCars: "Сейчас нет авто с 360°-обзором — посмотрите весь каталог.",
    browseCatalog: "Перейти в каталог",
    tradeInTitle: "Оценка трейд-ина",
    tradeInSubtitle: "Пришлите данные и фото своего авто — менеджер вернётся с оценкой.",
  },
  uz: {
    title: "Virtual shourum",
    subtitle: "Avtoni 360° ko'ring va treyd-in bahosini oling — uydan chiqmasdan.",
    inspectorTitle: "360° ko'rik",
    chooseCar: "Avtoni tanlang",
    viewDetails: "Avto haqida batafsil",
    from: "dan",
    noCars: "Hozircha 360° ko'rik mavjud emas — to'liq katalogni ko'ring.",
    browseCatalog: "Katalogga o'tish",
    tradeInTitle: "Treyd-in baholash",
    tradeInSubtitle: "Avtoingiz ma'lumotlari va rasmlarini yuboring — menejer baho bilan bog'lanadi.",
  },
  en: {
    title: "Virtual showroom",
    subtitle: "Inspect cars in 360° and get a trade-in estimate — from the comfort of home.",
    inspectorTitle: "360° inspection",
    chooseCar: "Choose a car",
    viewDetails: "View car details",
    from: "from",
    noCars: "No 360° cars available right now — browse the full catalog.",
    browseCatalog: "Browse catalog",
    tradeInTitle: "Trade-in estimate",
    tradeInSubtitle: "Send your car's details and photos — a manager will follow up with an estimate.",
  },
};

export function ShowroomContent({ cars }: { cars: ShowroomCar[] }) {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [selected, setSelected] = useState(0);
  const car = cars[selected];

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom max-w-6xl">
        <SectionHeading as="h1" title={t.title} subtitle={t.subtitle} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: real 360° inspector */}
          <section aria-labelledby="inspector-heading">
            <h2 id="inspector-heading" className="flex items-center gap-2 text-lg font-bold text-foreground mb-4">
              <Box className="w-5 h-5 text-neon-blue" />
              {t.inspectorTitle}
            </h2>

            {car ? (
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="aspect-video bg-black">
                  <Car360 key={car.panoId} panoId={car.panoId} poster={car.poster} locale={locale} />
                </div>
                <div className="p-4 space-y-3">
                  {cars.length > 1 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        {t.chooseCar}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {cars.map((c, i) => (
                          <button
                            key={c.slug}
                            type="button"
                            onClick={() => setSelected(i)}
                            aria-pressed={i === selected}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                              i === selected
                                ? "bg-neon-blue/15 border-neon-blue text-neon-blue"
                                : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {c.brand} {c.model} <span className="opacity-60">{c.year}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div>
                      <p className="font-bold text-foreground">{car.brand} {car.model} {car.year}</p>
                      {car.priceUsd > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {t.from} ${car.priceUsd.toLocaleString()}
                        </p>
                      )}
                    </div>
                    <Link
                      href={localizedPath(locale, `/catalog/${car.slug}`)}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline whitespace-nowrap"
                    >
                      {t.viewDetails}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-2xl border border-border p-10 text-center space-y-4">
                <p className="text-muted-foreground">{t.noCars}</p>
                <Link
                  href={localizedPath(locale, "/catalog")}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  {t.browseCatalog}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </section>

          {/* Right: real trade-in lead funnel (reuses the hardened endpoints) */}
          <section aria-labelledby="tradein-heading">
            <h2 id="tradein-heading" className="flex items-center gap-2 text-lg font-bold text-foreground mb-2">
              <Sparkles className="w-5 h-5 text-neon-blue" />
              {t.tradeInTitle}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">{t.tradeInSubtitle}</p>
            <TradeInForm sourcePage="showroom" />
          </section>
        </div>
      </div>
    </div>
  );
}
