"use client";

import Link from "next/link";
import Image from "next/image";
import { Fuel, Gauge, Zap, Settings2, CarFront, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";
import { formatPrice } from "@/lib/utils";
import { estimatedMonthlyFrom } from "@/lib/finance";
import type { Car } from "@/types/car";
import { FavoriteButton } from "./favorite-button";

interface CarCardProps {
  car: Car;
}

export function CarCard({ car }: CarCardProps) {
  const { locale, dictionary } = useLocale();
  const transmissionLabel = dictionary.hotOffers.transmission[car.transmission] || car.transmission;
  const discount = car.original_price_usd && car.original_price_usd > car.price_usd
    ? Math.round((1 - car.price_usd / car.original_price_usd) * 100)
    : 0;

  return (
    <Link
      href={localizedPath(locale, `/catalog/${car.slug}`)}
      className="group block bg-card rounded-none border border-border overflow-hidden transition-all duration-500 hover:border-[var(--line-3)] hover:shadow-2xl hover:-translate-y-0.5"
    >
      {/* Image Container */}
      <div className="relative aspect-[16/10] bg-muted overflow-hidden">
        {/* Real image if available */}
        {(car.thumbnail || car.images?.[0]) ? (
          <Image
            src={car.thumbnail || car.images![0]}
            alt={`${car.brand} ${car.model}`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30">
            <CarFront className="w-12 h-12 mb-2" aria-hidden />
            <span className="text-xl font-medium tracking-tight">
              {car.brand}
            </span>
          </div>
        )}

        {/* Hover overlay gradient */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-500" />

        {/* Top Badges */}
        <div className="absolute top-4 left-4 flex gap-2">
          {car.mileage === 0 && (
            <Badge variant="default" className="bg-primary text-primary-foreground font-medium rounded-none px-2 py-0.5 shadow-sm text-[10px] tracking-wider uppercase">
              {dictionary.hotOffers.new}
            </Badge>
          )}
          {car.inventory_status === "reserved" && (
            <Badge variant="secondary" className="font-medium rounded-none px-2 py-0.5 text-[10px] tracking-wider uppercase">Reserved</Badge>
          )}
          {car.inventory_status === "sold" && (
            <Badge variant="destructive" className="font-medium rounded-none px-2 py-0.5 text-[10px] tracking-wider uppercase">Sold</Badge>
          )}
          {car.fuel_type === "electric" && (
            <Badge variant="outline" className="bg-background/80 backdrop-blur-md text-foreground font-medium rounded-none px-2 py-0.5 text-[10px] tracking-wider uppercase border-none">
              <Zap className="w-3 h-3 mr-1" /> EV
            </Badge>
          )}
        </div>

        {/* Favorite */}
        <div className="absolute top-3 right-3">
          <FavoriteButton carId={car.id} />
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-medium tracking-tight text-foreground group-hover:text-foreground/80 transition-colors">
              {car.brand} {car.model}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 tracking-wide">{car.year} {dictionary.common.year}</p>
            {typeof car.review_count === "number" && car.review_count > 0 && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground" aria-label={`${car.review_avg} / 5`}>
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                <span className="font-medium text-foreground/80">{car.review_avg?.toFixed(1)}</span>
                <span className="text-muted-foreground/70">({car.review_count})</span>
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{dictionary.common.from}</p>
            {discount > 0 ? (
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground/60 line-through">
                  {formatPrice(car.original_price_usd!)}
                </p>
                <p className="text-lg font-mono font-semibold text-primary tracking-tight">
                  {formatPrice(car.price_usd)}
                </p>
              </div>
            ) : (
              <p className="text-lg font-mono font-semibold text-primary tracking-tight">{formatPrice(car.price_usd)}</p>
            )}
            {car.price_usd > 0 && (
              <p className="text-xs text-muted-foreground mt-1 tracking-wide">
                {dictionary.common.from} {formatPrice(estimatedMonthlyFrom(car.price_usd))}{dictionary.common.perMonth}
              </p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border my-4" />

        {/* Specs */}
        <div className="flex flex-wrap gap-4 mt-4">
          {car.engine_volume && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">
              <Fuel className="w-4 h-4 text-foreground/40" />
              {car.engine_volume} {dictionary.common.l}
            </div>
          )}
          {car.engine_power && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">
              <Gauge className="w-4 h-4 text-foreground/40" />
              {car.engine_power} {dictionary.common.hp}
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">
            <Settings2 className="w-4 h-4 text-foreground/40" />
            {transmissionLabel}
          </div>
        </div>
      </div>
    </Link>
  );
}
