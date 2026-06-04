"use client";

import { useEffect, useState } from "react";
import { SectionHeading } from "@/components/shared/section-heading";
import { CarCard } from "@/components/catalog/car-card";
import { useLocale } from "@/i18n/locale-context";
import { FadeInScroll } from "@/components/animations/fade-in";
import { getFavoriteIds } from "@/lib/favorites";
import type { Car } from "@/types/car";

const VIEWED_KEY = "tez-motors-recently-viewed";

/**
 * "Recommended for you" rail (Phase AO). Reads the visitor's behavioral signals
 * (recently-viewed + favorites from localStorage; the server also merges account
 * favorites when logged in), asks /api/cars/recommended to rank the catalog, and
 * renders the result. Hidden entirely when there's no personalized result — the
 * homepage hot-offers rail covers the cold-start case, so we never show a
 * generic "for you" that isn't actually personalized.
 */
export function ForYou() {
  const { locale } = useLocale();
  const [cars, setCars] = useState<Car[]>([]);

  useEffect(() => {
    let viewed: string[] = [];
    try {
      viewed = JSON.parse(localStorage.getItem(VIEWED_KEY) || "[]");
    } catch {
      viewed = [];
    }
    const ids = Array.from(new Set([...viewed, ...getFavoriteIds()])).slice(0, 20);
    // No client signal AND not logged in → the endpoint would only return hot
    // offers; skip the call and let the hot-offers rail handle it.
    const qs = ids.length ? `?ids=${encodeURIComponent(ids.join(","))}` : "";

    fetch(`/api/cars/recommended${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.personalized && Array.isArray(d.cars)) setCars(d.cars);
      })
      .catch(() => {});
  }, []);

  if (cars.length === 0) return null;

  const title = locale === "ru" ? "Рекомендуем вам" : locale === "uz" ? "Sizga tavsiya etamiz" : "Recommended for you";
  const subtitle =
    locale === "ru"
      ? "Подобрано по вашим просмотрам и избранному"
      : locale === "uz"
        ? "Ko'rganlaringiz va sevimlilaringiz asosida"
        : "Based on what you've viewed and saved";

  return (
    <section className="py-24 md:py-32 relative">
      <div className="container-custom relative z-10">
        <FadeInScroll direction="up">
          <SectionHeading title={title} subtitle={subtitle} centered={false} className="mb-16 max-w-2xl" />
        </FadeInScroll>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cars.slice(0, 6).map((car) => (
            <CarCard key={car.id} car={car} />
          ))}
        </div>
      </div>
    </section>
  );
}
