"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  ArrowLeft, Fuel, Gauge, Settings2, CarFront, Palette, Calendar,
  Zap, Send, Loader2, CheckCircle, Info, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/i18n/locale-context";
import { CarGallery } from "@/components/catalog/car-gallery";
import { ShareButtons } from "@/components/shared/share-buttons";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { RelatedCars } from "@/components/catalog/related-cars";
import { FavoriteButton } from "@/components/catalog/favorite-button";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { formatPrice } from "@/lib/utils";
import { localizedPath } from "@/lib/locale-path";
import type { Car } from "@/types/car";
import { Turnstile } from "@/components/shared/turnstile";
import { ReservationModal } from "@/components/car/reservation-modal";
import { TestDriveModal } from "@/components/car/test-drive-modal";

export default function CarDetailPage() {
  const params = useParams();
  const { locale, dictionary } = useLocale();
  const { addViewed } = useRecentlyViewed();

  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showReserve, setShowReserve] = useState(false);
  const [showTestDrive, setShowTestDrive] = useState(false);

  useEffect(() => {
    fetch(`/api/cars/${params.slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.car) {
          setCar(data.car);
          addViewed(data.car.id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.slug]);

  if (loading) {
    return (
      <div className="pt-32 pb-16 text-center container-custom">
        <Loader2 className="w-8 h-8 animate-spin text-neon-blue mx-auto mb-3" />
        <p className="text-white/60">{locale === "ru" ? "Загрузка..." : "Loading..."}</p>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="pt-32 pb-16 text-center container-custom max-w-md mx-auto">
        <div className="text-6xl font-black text-white/[0.04] mb-6">404</div>
        <h1 className="text-xl font-bold mb-3 text-white">
          {locale === "ru" ? "Автомобиль не найден" : locale === "uz" ? "Avtomobil topilmadi" : "Car not found"}
        </h1>
        <p className="text-white/50 text-sm mb-8">
          {locale === "ru" ? "Возможно, этот автомобиль уже продан или ссылка устарела." : "This car may have been sold or the link is outdated."}
        </p>
        <Button asChild>
          <Link href={localizedPath(locale, "/catalog")}>
            {locale === "ru" ? "← Вернуться в каталог" : "← Back to Catalog"}
          </Link>
        </Button>
      </div>
    );
  }

  const description = locale === "uz" ? car.description_uz : locale === "en" ? car.description_en : car.description_ru;
  const discount = car.original_price_usd && car.original_price_usd > car.price_usd
    ? Math.round((1 - car.price_usd / car.original_price_usd) * 100)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          type: "car_inquiry",
          car_id: car.id,
          source_page: `/catalog/${car.slug}`,
          turnstile_token: turnstileToken ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error || (locale === "ru" ? "Ошибка отправки. Попробуйте ещё раз." : "Failed to send. Please try again."));
        return;
      }
      setIsSuccess(true);
      setForm({ name: "", phone: "", message: "" });
      setTimeout(() => setIsSuccess(false), 5000);
    } catch {
      setFormError(locale === "ru" ? "Нет соединения. Проверьте интернет." : "No connection. Check your internet.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const specs = [
    { icon: Calendar, label: locale === "ru" ? "Год" : "Year", value: `${car.year}` },
    ...(car.engine_volume ? [{ icon: Fuel, label: locale === "ru" ? "Двигатель" : "Engine", value: `${car.engine_volume} ${dictionary.common.l}` }] : []),
    ...(car.engine_power ? [{ icon: Gauge, label: locale === "ru" ? "Мощность" : "Power", value: `${car.engine_power} ${dictionary.common.hp}` }] : []),
    { icon: Settings2, label: locale === "ru" ? "КПП" : "Transmission", value: dictionary.hotOffers.transmission[car.transmission] },
    ...(car.drivetrain ? [{ icon: CarFront, label: locale === "ru" ? "Привод" : "Drivetrain", value: car.drivetrain.toUpperCase() }] : []),
    ...(car.color ? [{ icon: Palette, label: locale === "ru" ? "Цвет" : "Color", value: car.color }] : []),
    ...(car.fuel_type === "electric" || car.fuel_type === "phev"
      ? [{ icon: Zap, label: locale === "ru" ? "Тип" : "Type", value: car.fuel_type === "electric" ? "Electric" : "PHEV" }]
      : []),
  ];

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <Breadcrumbs
          items={[
            { label: dictionary.catalog.title, href: "/catalog" },
            { label: `${car.brand} ${car.model}` },
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-3 space-y-6">
            <div className="animate-fade-in-up">
              <CarGallery images={car.images} brand={car.brand} model={car.model} />
            </div>

            {car.video_url && (
              <div className="bg-[#0d0d15] rounded-2xl border border-white/10 overflow-hidden animate-fade-in-up" style={{ animationDelay: "120ms" }}>
                <div className="aspect-video">
                  <iframe
                    title={`${car.brand} ${car.model} video`}
                    src={car.video_url}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            {description && (
              <div className="bg-[#0d0d15] rounded-2xl border border-white/10 p-6 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
                <h2 className="font-bold text-lg mb-3 flex items-center gap-2 text-white">
                  <Info className="w-5 h-5 text-neon-blue" />
                  {locale === "ru" ? "Описание" : locale === "uz" ? "Tavsif" : "Description"}
                </h2>
                <p className="text-white/60 leading-relaxed">{description}</p>
              </div>
            )}

            <div className="bg-[#0d0d15] rounded-2xl border border-white/10 p-6 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
              <h2 className="font-bold text-lg mb-4 text-white">
                {locale === "ru" ? "Характеристики" : locale === "uz" ? "Xususiyatlar" : "Specifications"}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {specs.map((spec, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                    <spec.icon className="w-5 h-5 text-neon-blue shrink-0" />
                    <div>
                      <p className="text-xs text-white/60">{spec.label}</p>
                      <p className="text-sm font-semibold">{spec.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {Object.keys(car.specs).length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(car.specs).map(([key, value]) => (
                    <div key={key} className="p-3 rounded-xl bg-white/5">
                      <p className="text-xs text-white/60 capitalize">{key.replace(/_/g, " ")}</p>
                      <p className="text-sm font-semibold">{String(value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#0d0d15] rounded-2xl border border-white/10 p-6 sticky top-24 animate-slide-in-right">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  {car.mileage === 0 && <Badge>New</Badge>}
                  {car.fuel_type === "electric" && <Badge variant="info">EV</Badge>}
                  {car.fuel_type === "phev" && <Badge variant="info">PHEV</Badge>}
                </div>
                <h1 className="text-2xl font-bold text-white">
                  {car.brand} {car.model}
                </h1>
                <p className="text-white/60">{car.year}</p>
              </div>

              <div className="bg-neon-blue/10 rounded-xl p-4 mb-4">
                <p className="text-xs text-white/60 mb-1">{dictionary.common.from}</p>
                {discount > 0 ? (
                  <>
                    <p className="text-sm text-white/45 line-through">{formatPrice(car.original_price_usd!)}</p>
                    <p className="text-3xl font-bold text-neon-blue">
                      {formatPrice(car.price_usd)} <span className="text-sm text-amber-300">-{discount}%</span>
                    </p>
                  </>
                ) : (
                  <p className="text-3xl font-bold text-neon-blue">{formatPrice(car.price_usd)}</p>
                )}
                {car.price_uzs && (
                  <p className="text-sm text-white/60 mt-1">
                    ~ {formatPrice(car.price_uzs, "UZS")}
                  </p>
                )}
              </div>

              <ShareButtons
                title={`${car.brand} ${car.model} ${car.year} — ${formatPrice(car.price_usd)} | Tez Motors`}
                className="mb-6 pb-4 border-b border-white/10"
              />

              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="text-sm text-white/60">
                  {locale === "ru" ? "Сохранить в избранное" : "Save to favorites"}
                </div>
                <FavoriteButton carId={car.id} />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowTestDrive(true)}
                >
                  Test drive
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowReserve(true)}
                  disabled={car.inventory_status !== "available"}
                >
                  Reserve
                </Button>
              </div>
              <Button type="button" variant="outline" asChild className="w-full mb-4">
                <a href={`/api/cars/${car.id}/pdf`} download>
                  Download PDF spec sheet
                </a>
              </Button>

              {isSuccess ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-neon-blue mx-auto mb-3" />
                  <p className="font-semibold">{dictionary.contact.success}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h3 className="font-semibold">{dictionary.catalog.orderCar}</h3>
                  {car.inventory_status !== "available" && (
                    <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm text-white/60">
                      {car.inventory_status === "reserved" ? "This car is currently reserved." : "This car is sold."}
                    </div>
                  )}
                  <Input
                    placeholder={dictionary.contact.name}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                  <Input
                    type="tel"
                    placeholder={dictionary.contact.phone}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    required
                  />
                  <Textarea
                    placeholder={dictionary.contact.message}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    rows={3}
                  />
                  <Turnstile onToken={setTurnstileToken} />
                  {formError && (
                    <p className="text-sm text-red-400 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />{formError}
                    </p>
                  )}
                  <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        {dictionary.contact.submit}
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Related cars */}
        <RelatedCars currentCar={car} />
      </div>

      <ReservationModal
        carId={car.id}
        carName={`${car.brand} ${car.model}`}
        open={showReserve}
        onClose={() => setShowReserve(false)}
      />
      <TestDriveModal
        carId={car.id}
        carName={`${car.brand} ${car.model}`}
        open={showTestDrive}
        onClose={() => setShowTestDrive(false)}
      />
    </div>
  );
}
