"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowRight, CarFront, X as XIcon, Plus, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";
import { formatPrice, cn } from "@/lib/utils";
import type { Car } from "@/types/car";

export default function CompareContent({ initialIds }: { initialIds?: string[] } = {}) {
  const { locale, dictionary } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [allCars, setAllCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const syncToUrl = useCallback((ids: string[]) => {
    // When exactly two cars are selected, prefer the canonical pair URL
    // (`/compare/[a-vs-b]`) so shares + bookmarks are stable + indexable.
    // Other counts (0, 1, 3, 4) fall back to the query-string form.
    if (ids.length === 2) {
      const a = allCars.find((c) => c.id === ids[0]);
      const b = allCars.find((c) => c.id === ids[1]);
      if (a?.slug && b?.slug) {
        router.replace(localizedPath(locale, `/compare/${a.slug}-vs-${b.slug}`), { scroll: false });
        return;
      }
    }
    const params = ids.length > 0 ? `?ids=${ids.join(",")}` : "";
    router.replace(localizedPath(locale, `/compare${params}`), { scroll: false });
  }, [locale, router, allCars]);

  useEffect(() => {
    fetch("/api/cars")
      .then((r) => r.json())
      .then((data) => {
        const cars = data.cars || [];
        setAllCars(cars);
        // Priority: initialIds prop (canonical compare URL) > URL ?ids= > first 3.
        const seedIds = initialIds && initialIds.length > 0
          ? initialIds
          : searchParams.get("ids")?.split(",").filter(Boolean) || [];
        const validIds = seedIds.filter((id) => cars.some((c: Car) => c.id === id));
        if (validIds.length > 0) {
          setSelectedIds(validIds);
        } else {
          setSelectedIds(cars.slice(0, 3).map((c: Car) => c.id));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shareComparison = async () => {
    // Match the canonical-URL logic in syncToUrl: 2 cars → /compare/[slug],
    // anything else → /compare?ids=…
    let path: string;
    if (selectedIds.length === 2) {
      const a = allCars.find((c) => c.id === selectedIds[0]);
      const b = allCars.find((c) => c.id === selectedIds[1]);
      path = a?.slug && b?.slug
        ? `/compare/${a.slug}-vs-${b.slug}`
        : `/compare?ids=${selectedIds.join(",")}`;
    } else {
      path = `/compare?ids=${selectedIds.join(",")}`;
    }
    const url = `${window.location.origin}${localizedPath(locale, path)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const selectedCars = useMemo(
    () => selectedIds.map((id) => allCars.find((c) => c.id === id)).filter(Boolean) as Car[],
    [selectedIds, allCars]
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
    syncToUrl(newIds);
    setShowPicker(null);
  };

  const removeCar = (index: number) => {
    const newIds = selectedIds.filter((_, i) => i !== index);
    setSelectedIds(newIds);
    syncToUrl(newIds);
  };

  const addCar = (carId: string) => {
    const newIds = [...selectedIds, carId];
    setSelectedIds(newIds);
    syncToUrl(newIds);
    setShowPicker(null);
  };

  if (loading) {
    return (
      <div className="pt-32 pb-16 text-center container-custom">
        <Loader2 className="w-8 h-8 animate-spin text-neon-blue mx-auto mb-3" />
      </div>
    );
  }

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <div className="flex items-start justify-between gap-4 mb-10">
          <SectionHeading title={title} subtitle={subtitle} className="mb-0" />
          {selectedIds.length > 0 && (
            <button
              onClick={shareComparison}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/20 text-sm transition-colors mt-2"
            >
              <Share2 className="w-4 h-4" />
              {copied
                ? locale === "ru" ? "Скопировано!" : "Copied!"
                : locale === "ru" ? "Поделиться" : locale === "uz" ? "Ulashish" : "Share"}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr>
                <th className="p-4 text-left w-40 text-sm font-semibold text-white/60" />
                {selectedCars.map((car, index) => (
                  <th key={car.id} className="p-4 text-center min-w-[200px]">
                    <div className="relative group">
                      <button
                        onClick={() => removeCar(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-100 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                      <div className="relative bg-gradient-to-br from-neon-blue/10 to-neon-purple/10 rounded-2xl overflow-hidden mb-3 aspect-[4/3]">
                        {(car.thumbnail || car.images?.[0]) ? (
                          <Image
                            src={car.thumbnail || car.images![0]}
                            alt={`${car.brand} ${car.model}`}
                            fill
                            className="object-cover"
                            sizes="200px"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <CarFront className="w-12 h-12 text-neon-blue/20" />
                          </div>
                        )}
                      </div>
                      <Link href={localizedPath(locale, `/catalog/${car.slug}`)} className="font-bold text-white hover:text-neon-blue transition-colors">
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
                        className="mt-2 text-xs text-white/60 hover:text-neon-blue transition-colors"
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
                      className="w-full h-32 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-white/60 hover:border-neon-blue hover:text-neon-blue transition-colors"
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
                <tr key={i} className={i % 2 === 0 ? "bg-white/[0.02]" : ""}>
                  <td className="p-4 text-sm font-semibold text-white">{row.label}</td>
                  {selectedCars.map((car) => {
                    const val = row.render(car);
                    const isPrice = row.label.includes("Цена") || row.label.includes("Price");
                    return (
                      <td key={car.id} className={cn("p-4 text-center text-sm text-white", isPrice && "font-bold text-neon-blue text-lg")}>
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
              <Link href={localizedPath(locale, `/catalog/${car.slug}`)}>
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
            <div className="animate-fade-in relative bg-[#0d0d15] border border-white/10 rounded-2xl w-full max-w-lg max-h-[70vh] overflow-y-auto p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-4">{locale === "ru" ? "Выберите автомобиль" : "Select a car"}</h3>
              <div className="space-y-2">
                {allCars.filter((c) => !selectedIds.includes(c.id)).map((car) => (
                  <button
                    key={car.id}
                    onClick={() => showPicker < selectedIds.length ? replaceCar(showPicker, car.id) : addCar(car.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-blue/10 to-neon-purple/10 flex items-center justify-center shrink-0">
                      <CarFront className="w-5 h-5 text-neon-blue/20" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-white">{car.brand} {car.model}</p>
                      <p className="text-xs text-white/60">{car.year} &middot; {formatPrice(car.price_usd)}</p>
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
