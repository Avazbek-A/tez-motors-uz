"use client";

import Link from "next/link";
import { Fuel, Gauge, Zap, Settings2, CarFront } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-context";
import { formatPrice } from "@/lib/utils";
import type { Car } from "@/types/car";

const brandGradients: Record<string, string> = {
  BYD: "from-blue-900/20 via-blue-800/10 to-sky-700/5",
  Chery: "from-red-900/15 via-red-800/8 to-orange-700/5",
  Haval: "from-emerald-900/15 via-emerald-800/8 to-green-700/5",
  Geely: "from-indigo-900/15 via-indigo-800/8 to-violet-700/5",
  Changan: "from-slate-900/20 via-slate-800/10 to-gray-700/5",
  JETOUR: "from-cyan-900/15 via-cyan-800/8 to-teal-700/5",
  Tank: "from-amber-900/20 via-amber-800/10 to-yellow-700/5",
  Zeekr: "from-violet-900/20 via-violet-800/10 to-purple-700/5",
  "Li Auto": "from-zinc-900/20 via-zinc-800/10 to-stone-700/5",
  Exeed: "from-rose-900/15 via-rose-800/8 to-pink-700/5",
  Omoda: "from-orange-900/15 via-orange-800/8 to-amber-700/5",
  Hongqi: "from-red-950/20 via-red-900/10 to-red-800/5",
  GAC: "from-sky-900/15 via-sky-800/8 to-blue-700/5",
  XPeng: "from-teal-900/15 via-teal-800/8 to-emerald-700/5",
};

interface CarCardProps {
  car: Car;
}

export function CarCard({ car }: CarCardProps) {
  const { dictionary } = useLocale();
  const transmissionLabel = dictionary.hotOffers.transmission[car.transmission] || car.transmission;
  const gradient = brandGradients[car.brand] || "from-navy/10 via-navy/5 to-muted";

  return (
    <Link
      href={`/catalog/${car.slug}`}
      className="group block bg-white rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
    >
      {/* Image */}
      <div className={`relative aspect-[4/3] bg-gradient-to-br ${gradient} overflow-hidden`}>
        {/* Brand watermark */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <CarFront className="w-16 h-16 text-navy/10 group-hover:text-navy/15 transition-colors duration-500 group-hover:scale-110" />
          <span className="text-navy/15 text-xs font-bold mt-2 tracking-wider uppercase">
            {car.brand}
          </span>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-lime/0 group-hover:bg-lime/5 transition-colors duration-300" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {car.mileage === 0 && (
            <Badge variant="default" className="bg-lime text-navy shadow-sm">
              {dictionary.hotOffers.new}
            </Badge>
          )}
          {car.fuel_type === "electric" && (
            <Badge variant="info" className="shadow-sm">
              <Zap className="w-3 h-3 mr-1" />
              EV
            </Badge>
          )}
          {car.fuel_type === "phev" && (
            <Badge variant="info" className="shadow-sm">PHEV</Badge>
          )}
          {car.fuel_type === "hybrid" && (
            <Badge variant="success" className="shadow-sm">Hybrid</Badge>
          )}
        </div>

        {/* Price overlay on image */}
        <div className="absolute bottom-3 right-3">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-sm">
            <p className="text-xs text-muted-foreground leading-none">{dictionary.common.from}</p>
            <p className="text-lg font-bold text-navy leading-tight">{formatPrice(car.price_usd)}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="mb-3">
          <h3 className="text-lg font-bold text-foreground group-hover:text-lime-dark transition-colors">
            {car.brand} {car.model}
          </h3>
          <p className="text-sm text-muted-foreground">{car.year} {dictionary.common.year}</p>
        </div>

        {/* Specs */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {car.engine_volume && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Fuel className="w-3.5 h-3.5 text-lime-dark/60" />
              {car.engine_volume} {dictionary.common.l}
            </div>
          )}
          {car.engine_power && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Gauge className="w-3.5 h-3.5 text-lime-dark/60" />
              {car.engine_power} {dictionary.common.hp}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Settings2 className="w-3.5 h-3.5 text-lime-dark/60" />
            {transmissionLabel}
          </div>
          {car.drivetrain && (
            <div className="text-xs text-muted-foreground font-medium uppercase">
              {car.drivetrain}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
