"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/section-heading";
import { CarCard } from "@/components/catalog/car-card";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";
import { FadeInScroll } from "@/components/animations/fade-in";
import type { Car } from "@/types/car";

interface HotOffersProps {
  cars: Car[];
}

export function HotOffers({ cars }: HotOffersProps) {
  const { locale, dictionary } = useLocale();

  return (
    <section className="py-24 md:py-32 bg-secondary/30 relative">
      <div className="container-custom relative z-10">
        <FadeInScroll direction="up">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 mb-16">
            <SectionHeading
              title={dictionary.hotOffers.title}
              subtitle={dictionary.hotOffers.subtitle}
              centered={false}
              className="mb-0 max-w-2xl"
            />
            <Button
              variant="outline"
              size="lg"
              asChild
              className="shrink-0 tracking-wide uppercase text-xs rounded-none border-foreground hover:bg-foreground hover:text-background transition-all"
            >
              <Link href={localizedPath(locale, "/catalog")}>
                {dictionary.hotOffers.viewAll}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </FadeInScroll>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {cars.map((car, index) => (
            <FadeInScroll key={car.id} direction="up" delay={index * 0.1}>
              <CarCard car={car} />
            </FadeInScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
