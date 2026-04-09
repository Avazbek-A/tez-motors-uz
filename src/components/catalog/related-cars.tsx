"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CarCard } from "@/components/catalog/car-card";
import { useLocale } from "@/i18n/locale-context";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import type { Car } from "@/types/car";

interface RelatedCarsProps {
  currentCar: Car;
  maxCount?: number;
}

export function RelatedCars({ currentCar, maxCount = 4 }: RelatedCarsProps) {
  const { locale } = useLocale();
  const { ref, isVisible } = useScrollReveal();
  const [related, setRelated] = useState<Car[]>([]);

  useEffect(() => {
    fetch("/api/cars")
      .then((r) => r.json())
      .then((data) => {
        const allCars: Car[] = data.cars || [];
        const scored = allCars
          .filter((c) => c.id !== currentCar.id && c.is_available)
          .map((c) => {
            let score = 0;
            if (c.brand === currentCar.brand) score += 3;
            if (c.body_type === currentCar.body_type) score += 2;
            if (c.fuel_type === currentCar.fuel_type) score += 2;
            if (Math.abs(c.price_usd - currentCar.price_usd) < 10000) score += 1;
            return { car: c, score };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, maxCount)
          .map((r) => r.car);
        setRelated(scored);
      })
      .catch(() => {});
  }, [currentCar.id, currentCar.brand, currentCar.body_type, currentCar.fuel_type, currentCar.price_usd, maxCount]);

  if (related.length === 0) return null;

  const title = locale === "ru" ? "Похожие автомобили" : locale === "uz" ? "O'xshash avtomobillar" : "Similar Cars";

  return (
    <section className="mt-16 pt-12 border-t border-white/[0.06]">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <Button variant="outline" size="sm" asChild>
          <Link href="/catalog">
            {locale === "ru" ? "Все авто" : "All cars"}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>

      <div
        ref={ref}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {related.map((car, index) => (
          <div
            key={car.id}
            className={isVisible ? "animate-fade-in-up" : "opacity-0"}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <CarCard car={car} />
          </div>
        ))}
      </div>
    </section>
  );
}
