"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/section-heading";
import { CarCard } from "@/components/catalog/car-card";
import { useLocale } from "@/i18n/locale-context";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import type { Car } from "@/types/car";

interface HotOffersProps {
  cars: Car[];
}

export function HotOffers({ cars }: HotOffersProps) {
  const { dictionary } = useLocale();
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-20 md:py-28">
      <div className="container-custom">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-12">
          <SectionHeading
            title={dictionary.hotOffers.title}
            subtitle={dictionary.hotOffers.subtitle}
            centered={false}
            className="mb-0"
          />
          <Button variant="outline" asChild className="shrink-0">
            <Link href="/catalog">
              {dictionary.hotOffers.viewAll}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>

        <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {cars.map((car, index) => (
            <div
              key={car.id}
              className={`${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CarCard car={car} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
