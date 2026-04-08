"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CarCard } from "@/components/catalog/car-card";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { MOCK_CARS } from "@/lib/mock-data";

export function RecentlyViewed() {
  const { locale } = useLocale();
  const { viewedIds, clearViewed } = useRecentlyViewed();

  const recentCars = viewedIds
    .map((id) => MOCK_CARS.find((c) => c.id === id))
    .filter(Boolean);

  if (recentCars.length === 0) return null;

  const title = locale === "ru" ? "Недавно просмотренные" : locale === "uz" ? "Yaqinda ko'rilgan" : "Recently Viewed";

  return (
    <section className="py-12">
      <div className="container-custom">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={clearViewed} className="text-muted-foreground">
            <X className="w-4 h-4" />
            {locale === "ru" ? "Очистить" : "Clear"}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {recentCars.map((car) => car && (
            <CarCard key={car.id} car={car} />
          ))}
        </div>
      </div>
    </section>
  );
}
