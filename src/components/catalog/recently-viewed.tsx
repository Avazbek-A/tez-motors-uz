"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CarCard } from "@/components/catalog/car-card";
import { useLocale } from "@/i18n/locale-context";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import type { Car } from "@/types/car";

export function RecentlyViewed() {
  const { locale } = useLocale();
  const { viewedIds, clearViewed } = useRecentlyViewed();
  const [recentCars, setRecentCars] = useState<Car[]>([]);

  useEffect(() => {
    if (viewedIds.length === 0) return;
    fetch(`/api/cars?ids=${viewedIds.join(",")}`)
      .then((r) => r.json())
      .then((data) => {
        const fetched: Car[] = data.cars || [];
        // Preserve the view order
        const ordered = viewedIds
          .map((id) => fetched.find((c) => c.id === id))
          .filter(Boolean) as Car[];
        setRecentCars(ordered);
      })
      .catch(() => {});
  }, [viewedIds]);

  if (recentCars.length === 0) return null;

  const title = locale === "ru" ? "Недавно просмотренные" : locale === "uz" ? "Yaqinda ko'rilgan" : "Recently Viewed";

  return (
    <section className="py-12 bg-[#0a0a0f]">
      <div className="container-custom">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <Button variant="ghost" size="sm" onClick={clearViewed} className="text-white/60 hover:text-neon-pink">
            <X className="w-4 h-4" />
            {locale === "ru" ? "Очистить" : "Clear"}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {recentCars.map((car) => (
            <CarCard key={car.id} car={car} />
          ))}
        </div>
      </div>
    </section>
  );
}
