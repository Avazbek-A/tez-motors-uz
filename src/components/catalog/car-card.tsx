"use client";

import Link from "next/link";
import Image from "next/image";
import { Fuel, Gauge, Zap, Settings2, CarFront } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/i18n/locale-context";
import { formatPrice } from "@/lib/utils";
import type { Car } from "@/types/car";

const brandGradients: Record<string, string> = {
  BYD: "from-[#00d4ff]/15 via-[#00d4ff]/5 to-transparent",
  Chery: "from-[#ff2d87]/15 via-[#ff2d87]/5 to-transparent",
  Haval: "from-[#22ff88]/15 via-[#22ff88]/5 to-transparent",
  Geely: "from-[#8b5cf6]/15 via-[#8b5cf6]/5 to-transparent",
  Changan: "from-[#00d4ff]/10 via-[#8b5cf6]/5 to-transparent",
  JETOUR: "from-[#00d4ff]/15 via-[#22ff88]/5 to-transparent",
  Tank: "from-[#ff2d87]/15 via-[#8b5cf6]/5 to-transparent",
  Zeekr: "from-[#8b5cf6]/20 via-[#00d4ff]/5 to-transparent",
  "Li Auto": "from-[#22ff88]/10 via-[#00d4ff]/5 to-transparent",
  Exeed: "from-[#ff2d87]/15 via-[#8b5cf6]/5 to-transparent",
  Omoda: "from-[#ff2d87]/10 via-[#22ff88]/5 to-transparent",
  Hongqi: "from-[#ff2d87]/20 via-[#ff2d87]/5 to-transparent",
  GAC: "from-[#00d4ff]/15 via-[#8b5cf6]/5 to-transparent",
  XPeng: "from-[#22ff88]/15 via-[#00d4ff]/5 to-transparent",
};

const brandBorderColors: Record<string, string> = {
  BYD: "group-hover:border-[#00d4ff]/60",
  Chery: "group-hover:border-[#ff2d87]/60",
  Haval: "group-hover:border-[#22ff88]/60",
  Geely: "group-hover:border-[#8b5cf6]/60",
  Changan: "group-hover:border-[#00d4ff]/50",
  JETOUR: "group-hover:border-[#00d4ff]/60",
  Tank: "group-hover:border-[#ff2d87]/60",
  Zeekr: "group-hover:border-[#8b5cf6]/60",
  "Li Auto": "group-hover:border-[#22ff88]/50",
  Exeed: "group-hover:border-[#ff2d87]/60",
  Omoda: "group-hover:border-[#ff2d87]/50",
  Hongqi: "group-hover:border-[#ff2d87]/60",
  GAC: "group-hover:border-[#00d4ff]/60",
  XPeng: "group-hover:border-[#22ff88]/60",
};

interface CarCardProps {
  car: Car;
}

export function CarCard({ car }: CarCardProps) {
  const { dictionary } = useLocale();
  const transmissionLabel = dictionary.hotOffers.transmission[car.transmission] || car.transmission;
  const gradient = brandGradients[car.brand] || "from-[#00d4ff]/10 via-[#8b5cf6]/5 to-transparent";
  const borderColor = brandBorderColors[car.brand] || "group-hover:border-neon-blue/50";

  return (
    <Link
      href={`/catalog/${car.slug}`}
      className={`group block bg-[#0d0d15] rounded-2xl border border-white/[0.06] overflow-hidden shadow-sm hover:shadow-[0_0_30px_rgba(0,212,255,0.15)] transition-all duration-300 hover:-translate-y-1 ${borderColor}`}
    >
      {/* Image */}
      <div className={`relative aspect-[4/3] bg-gradient-to-br ${gradient} overflow-hidden`}>
        {/* Real image if available */}
        {(car.thumbnail || car.images?.[0]) ? (
          <Image
            src={car.thumbnail || car.images![0]}
            alt={`${car.brand} ${car.model}`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        ) : (
          /* Brand watermark placeholder */
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <CarFront className="w-16 h-16 text-neon-blue/10 group-hover:text-neon-blue/20 transition-colors duration-500 group-hover:scale-110" />
            <span className="text-neon-blue/15 text-xs font-bold mt-2 tracking-wider uppercase font-mono">
              {car.brand}
            </span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-neon-blue/0 group-hover:bg-neon-blue/5 transition-colors duration-300" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {car.mileage === 0 && (
            <Badge variant="default" className="bg-neon-green/90 text-[#0a0a0f] shadow-[0_0_10px_rgba(34,255,136,0.3)]">
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
          <div className="bg-[#0a0a0f]/80 backdrop-blur-md rounded-xl px-3 py-1.5 border border-neon-blue/30 shadow-[0_0_15px_rgba(0,212,255,0.15)]">
            <p className="text-xs text-neon-blue/60 leading-none font-mono">{dictionary.common.from}</p>
            <p className="text-lg font-bold text-neon-green leading-tight font-mono">{formatPrice(car.price_usd)}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="mb-3">
          <h3 className="text-lg font-bold text-white/90 group-hover:text-neon-blue transition-colors">
            {car.brand} {car.model}
          </h3>
          <p className="text-sm text-white/60 font-mono">{car.year} {dictionary.common.year}</p>
        </div>

        {/* Specs */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {car.engine_volume && (
            <div className="flex items-center gap-1.5 text-xs text-white/60">
              <Fuel className="w-3.5 h-3.5 text-neon-blue/50" />
              {car.engine_volume} {dictionary.common.l}
            </div>
          )}
          {car.engine_power && (
            <div className="flex items-center gap-1.5 text-xs text-white/60">
              <Gauge className="w-3.5 h-3.5 text-neon-blue/50" />
              {car.engine_power} {dictionary.common.hp}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-white/60">
            <Settings2 className="w-3.5 h-3.5 text-neon-blue/50" />
            {transmissionLabel}
          </div>
          {car.drivetrain && (
            <div className="text-xs text-white/60 font-medium uppercase">
              {car.drivetrain}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
