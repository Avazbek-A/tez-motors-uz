"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, CarFront, Check, X as XIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { MOCK_CARS } from "@/lib/mock-data";
import { formatPrice, cn } from "@/lib/utils";
import type { Car } from "@/types/car";

export default function ComparePage() {
  const { locale, dictionary } = useLocale();
  const [selectedIds, setSelectedIds] = useState<string[]>([
    MOCK_CARS[0]?.id,
    MOCK_CARS[1]?.id,
    MOCK_CARS[2]?.id,
  ].filter(Boolean));
  const [showPicker, setShowPicker] = useState<number | null>(null);

  const selectedCars = useMemo(
    () => selectedIds.map((id) => MOCK_CARS.find((c) => c.id === id)).filter(Boolean) as Car[],
    [selectedIds]
  );

  const title = locale === "ru" ? "Сравнение автомобилей" : locale === "uz" ? "Avtomobillarni solishtirish" : "Compare Cars";
  const subtitle = locale === "ru"
    ? "Сравните характеристики и цены нескольких автомобилей"
    : locale === "uz" ? "Bir nechta avtomobillarning xususiyatlari va narxlarini solishtiring"
    : "Compare specs and prices of multiple cars";

  const specRows = [
    { label: locale === "ru" ? "Цена" : "Price", render: (c: Car) => formatPrice(c.price_usd) },
    { label: locale === "ru" ? "Год" : "Year", render: (c: Car) => `${c.year}` },
    { label: locale === "ru" ? "Кузов" : "Body", render: (c: Car) => c.body_type },
    { label: locale === "ru" ? "Топливо" : "Fuel", render: (c: Car) => c.fuel_type },
    { label: locale === "ru" ? "Двигатель" : "Engine", render: (c: Car) => c.engine_volume ? `${c.engine_volume} L` : "Electric" },
    { label: locale === "ru" ? "Мощность" : "Power", render: (c: Car) => c.engine_power ? `${c.engine_power} ${dictionary.common.hp}` : "—" },
    { label: locale === "ru" ? "КПП" : "Trans.", render: (c: Car) => dictionary.hotOffers.transmission[c.transmission] || c.transmission },
    { label: locale === "ru" ? "Привод" : "Drive", render: (c: Car) => c.drivetrain?.toUpperCase() || "—" },
    { label: locale === "ru" ? "Пробег" : "Mileage", render: (c: Car) => c.mileage === 0 ? (locale === "ru" ? "Новый" : "New") : `${c.mileage} km` },
  ];

  const replaceCar = (index: number, carId: string) => {
    const newIds = [...selectedIds];
    newIds[index] = carId;
    setSelectedIds(newIds);
    setShowPicker(null);
  };

  const removeCar = (index: number) => {
    setSelectedIds(selectedIds.filter((_, i) => i !== index));
  };

  const addCar = (carId: string) => {
    setSelectedIds([...selectedIds, carId]);
    setShowPicker(null);
  };

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading title={title} subtitle={subtitle} />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr>
                <th className="p-4 text-left w-40 text-sm font-semibold text-muted-foreground" />
                {selectedCars.map((car, index) => (
                  <th key={car.id} className="p-4 text-center min-w-[200px]">
                    <div className="relative group">
                      <button
                        onClick={() => removeCar(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-100 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                      <div className="bg-gradient-to-br from-navy/5 to-lime/5 rounded-2xl p-4 mb-3">
                        <CarFront className="w-12 h-12 text-navy/15 mx-auto" />
                      </div>
                      <Link href={`/catalog/${car.slug}`} className="font-bold text-foreground hover:text-lime-dark transition-colors">
                        {car.brand} {car.model}
                      </Link>
                      <div className="flex justify-center gap-1 mt-1">
                        {car.mileage === 0 && <Badge variant="default" className="text-[10px]">{dictionary.hotOffers.new}</Badge>}
                        {(car.fuel_type === "electric" || car.fuel_type === "phev") && (
                          <Badge variant="info" className="text-[10px]">{car.fuel_type.toUpperCase()}</Badge>
                        )}
                      </div>
                      <button
                        onClick={() => setShowPicker(index)}
                        className="mt-2 text-xs text-muted-foreground hover:text-lime-dark transition-colors"
                      >
                        {locale === "ru" ? "Заменить" : "Change"}
                      </button>
                    </div>
                  </th>
                ))}
                {selectedCars.length < 4 && (
                  <th className="p-4 text-center min-w-[200px]">
                    <button
                      onClick={() => setShowPicker(selectedIds.length)}
                      className="w-full h-32 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-muted-foreground hover:border-lime hover:text-lime-dark transition-colors"
                    >
                      <Plus className="w-8 h-8 mb-1" />
                      <span className="text-sm">{locale === "ru" ? "Добавить" : "Add"}</span>
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {specRows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                  <td className="p-4 text-sm font-semibold text-foreground">{row.label}</td>
                  {selectedCars.map((car) => {
                    const val = row.render(car);
                    const isPrice = row.label.includes("Цена") || row.label.includes("Price");
                    return (
                      <td key={car.id} className={cn("p-4 text-center text-sm", isPrice && "font-bold text-navy text-lg")}>
                        {val}
                      </td>
                    );
                  })}
                  {selectedCars.length < 4 && <td />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* View details links */}
        <div className="flex justify-center gap-4 mt-8">
          {selectedCars.map((car) => (
            <Button key={car.id} variant="outline" size="sm" asChild>
              <Link href={`/catalog/${car.slug}`}>
                {car.brand} {car.model}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          ))}
        </div>

        {/* Car picker modal */}
        {showPicker !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPicker(null)} />
            <div className="animate-fade-in relative bg-white rounded-2xl w-full max-w-lg max-h-[70vh] overflow-y-auto p-6 shadow-2xl">
              <h3 className="text-lg font-bold mb-4">{locale === "ru" ? "Выберите автомобиль" : "Select a car"}</h3>
              <div className="space-y-2">
                {MOCK_CARS.filter((c) => !selectedIds.includes(c.id)).map((car) => (
                  <button
                    key={car.id}
                    onClick={() => showPicker < selectedIds.length ? replaceCar(showPicker, car.id) : addCar(car.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-navy/5 to-lime/5 flex items-center justify-center shrink-0">
                      <CarFront className="w-5 h-5 text-navy/20" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{car.brand} {car.model}</p>
                      <p className="text-xs text-muted-foreground">{car.year} &middot; {formatPrice(car.price_usd)}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{car.body_type}</Badge>
                  </button>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t">
                <Button variant="outline" className="w-full" onClick={() => setShowPicker(null)}>
                  {locale === "ru" ? "Закрыть" : "Close"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
