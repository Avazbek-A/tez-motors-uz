"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/section-heading";
import { CarCard } from "@/components/catalog/car-card";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { GridBackground } from "@/components/effects";
import type { Car } from "@/types/car";

interface HotOffersProps {
  cars: Car[];
}

export function HotOffers({ cars }: HotOffersProps) {
  const { locale, dictionary } = useLocale();
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-20 md:py-28 bg-[#0a0a0f] relative overflow-hidden">
      <GridBackground />

      {/* Ambient neon glows */}
      <div className="absolute top-0 left-1/3 w-80 h-80 bg-neon-blue/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-neon-purple/5 rounded-full blur-3xl" />

      <div className="container-custom relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-12">
          <SectionHeading
            title={dictionary.hotOffers.title}
            subtitle={dictionary.hotOffers.subtitle}
            centered={false}
            className="mb-0"
            light
          />
          <Button
            variant="outline"
            asChild
            className="shrink-0 border-neon-blue/30 text-neon-blue hover:bg-neon-blue/10 hover:border-neon-blue/50 transition-all"
          >
            <Link href={localizedPath(locale, "/catalog")}>
              {dictionary.hotOffers.viewAll}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>

        <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {cars.map((car, index) => (
            <div
              key={car.id}
              className={`group/card relative rounded-2xl transition-all duration-300
                hover:shadow-[0_0_25px_rgba(0,212,255,0.1)]
                ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Neon border on hover */}
              <div className="absolute inset-0 rounded-2xl border border-transparent group-hover/card:border-neon-blue/30 transition-all duration-300 pointer-events-none z-10" />
              <CarCard car={car} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
