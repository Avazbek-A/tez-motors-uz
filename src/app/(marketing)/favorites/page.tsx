"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Trash2, Heart, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";
import { getFavoriteIds, setFavorites } from "@/lib/favorites";
import { formatPrice } from "@/lib/utils";
import type { Car } from "@/types/car";
import { CarCard } from "@/components/catalog/car-card";
import { Turnstile } from "@/components/shared/turnstile";

export default function FavoritesPage() {
  const { dictionary, locale } = useLocale();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [selectedCarId, setSelectedCarId] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setFavoriteIds(getFavoriteIds());
    sync();
    window.addEventListener("tez-motors:favorites", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("tez-motors:favorites", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (favoriteIds.length === 0) {
      setCars([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/cars?ids=${favoriteIds.join(",")}`)
      .then((r) => r.json())
      .then((data) => {
        const items: Car[] = data.cars || [];
        setCars(favoriteIds.map((id) => items.find((car) => car.id === id)).filter(Boolean) as Car[]);
      })
      .catch(() => setCars([]))
      .finally(() => setLoading(false));
  }, [favoriteIds]);

  useEffect(() => {
    if (!selectedCarId && cars[0]) setSelectedCarId(cars[0].id);
  }, [cars, selectedCarId]);

  const selectedCar = useMemo(() => cars.find((car) => car.id === selectedCarId) || cars[0] || null, [cars, selectedCarId]);

  const submitWatch = async () => {
    if (!selectedCar || !email || !targetPrice) return;
    const res = await fetch("/api/price-watches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        car_id: selectedCar.id,
        target_price_usd: Number(targetPrice),
        turnstile_token: turnstileToken ?? undefined,
      }),
    });
    if (res.ok) {
      setMessage(locale === "ru" ? "Оповещение сохранено" : locale === "uz" ? "Bildirishnoma saqlandi" : "Watch saved");
      setEmail("");
      setTargetPrice("");
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to save watch");
    }
  };

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading
          title={locale === "ru" ? "Избранное" : locale === "uz" ? "Sevimlilar" : "Favorites"}
          subtitle={locale === "ru" ? "Сохраняйте интересные автомобили и отслеживайте цены." : "Save interesting cars and track prices."}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {loading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-neon-blue mx-auto" />
              </div>
            ) : cars.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#0d0d15] p-8 text-center text-white/60">
                <Heart className="mx-auto mb-3 h-10 w-10 text-rose-300/60" />
                <p>{locale === "ru" ? "Пока нет избранных авто." : "No saved cars yet."}</p>
                <Button asChild className="mt-4">
                  <Link href={localizedPath(locale, "/catalog")}>{dictionary.catalog.title}</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0d0d15] p-4 text-sm text-white/60">
                  <span>{cars.length} {locale === "ru" ? "авто в списке" : "cars saved"}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFavorites([])}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    {locale === "ru" ? "Очистить" : "Clear"}
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {cars.map((car) => (
                    <CarCard key={car.id} car={car} />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0d0d15] p-6 h-fit">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-neon-blue" />
              <h2 className="text-lg font-semibold">{locale === "ru" ? "Оповещение о снижении цены" : "Price-drop alert"}</h2>
            </div>
            <p className="text-sm text-white/60">
              {locale === "ru"
                ? "Получайте внутреннее уведомление для менеджера, когда цена уйдёт ниже вашего порога."
                : "Get an internal dealer notification when a saved car drops below your target price."}
            </p>
            <div className="space-y-3">
              <label className="text-sm font-medium text-white/70 block">
                {locale === "ru" ? "Автомобиль" : "Car"}
              </label>
              <select
                value={selectedCarId}
                onChange={(e) => setSelectedCarId(e.target.value)}
                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white"
              >
                {cars.map((car) => (
                  <option key={car.id} value={car.id}>
                    {car.brand} {car.model} ({formatPrice(car.price_usd)})
                  </option>
                ))}
              </select>
              <Input
                type="email"
                placeholder={locale === "ru" ? "Email" : "Email"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="number"
                placeholder={locale === "ru" ? "Цель цены в USD" : "Target price in USD"}
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
              />
              <Turnstile onToken={setTurnstileToken} />
              {message && <p className="text-sm text-white/70">{message}</p>}
              <Button onClick={submitWatch} className="w-full" disabled={!selectedCar || !email || !targetPrice}>
                {locale === "ru" ? "Сохранить" : "Save watch"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
