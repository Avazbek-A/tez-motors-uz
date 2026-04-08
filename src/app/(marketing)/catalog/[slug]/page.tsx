"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft, Fuel, Gauge, Settings2, CarFront, Palette, Calendar,
  Zap, Send, Loader2, CheckCircle, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/i18n/locale-context";
import { CarGallery } from "@/components/catalog/car-gallery";
import { ShareButtons } from "@/components/shared/share-buttons";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { MOCK_CARS } from "@/lib/mock-data";
import { formatPrice } from "@/lib/utils";

export default function CarDetailPage() {
  const params = useParams();
  const { locale, dictionary } = useLocale();
  const car = MOCK_CARS.find((c) => c.slug === params.slug);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", message: "" });

  if (!car) {
    return (
      <div className="pt-32 pb-16 text-center container-custom">
        <h1 className="text-2xl font-bold mb-4">Car not found</h1>
        <Button asChild>
          <Link href="/catalog">Back to Catalog</Link>
        </Button>
      </div>
    );
  }

  const description = locale === "uz" ? car.description_uz : locale === "en" ? car.description_en : car.description_ru;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          type: "car_inquiry",
          car_id: car.id,
          source_page: `/catalog/${car.slug}`,
        }),
      });
      setIsSuccess(true);
      setForm({ name: "", phone: "", message: "" });
      setTimeout(() => setIsSuccess(false), 5000);
    } catch {
      // silent
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

            {description && (
              <div className="bg-white rounded-2xl border border-border p-6 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
                <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <Info className="w-5 h-5 text-lime-dark" />
                  {locale === "ru" ? "Описание" : locale === "uz" ? "Tavsif" : "Description"}
                </h2>
                <p className="text-muted-foreground leading-relaxed">{description}</p>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-border p-6 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
              <h2 className="font-bold text-lg mb-4">
                {locale === "ru" ? "Характеристики" : locale === "uz" ? "Xususiyatlar" : "Specifications"}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {specs.map((spec, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    <spec.icon className="w-5 h-5 text-lime-dark shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{spec.label}</p>
                      <p className="text-sm font-semibold">{spec.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {Object.keys(car.specs).length > 0 && (
                <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(car.specs).map(([key, value]) => (
                    <div key={key} className="p-3 rounded-xl bg-muted/50">
                      <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                      <p className="text-sm font-semibold">{String(value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-border p-6 sticky top-24 animate-slide-in-right">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  {car.mileage === 0 && <Badge>New</Badge>}
                  {car.fuel_type === "electric" && <Badge variant="info">EV</Badge>}
                  {car.fuel_type === "phev" && <Badge variant="info">PHEV</Badge>}
                </div>
                <h1 className="text-2xl font-bold text-foreground">
                  {car.brand} {car.model}
                </h1>
                <p className="text-muted-foreground">{car.year}</p>
              </div>

              <div className="bg-lime/10 rounded-xl p-4 mb-4">
                <p className="text-xs text-muted-foreground mb-1">{dictionary.common.from}</p>
                <p className="text-3xl font-bold text-navy">{formatPrice(car.price_usd)}</p>
                {car.price_uzs && (
                  <p className="text-sm text-muted-foreground mt-1">
                    ~ {formatPrice(car.price_uzs, "UZS")}
                  </p>
                )}
              </div>

              <ShareButtons
                title={`${car.brand} ${car.model} ${car.year} — ${formatPrice(car.price_usd)} | Tez Motors`}
                className="mb-6 pb-4 border-b border-border"
              />

              {isSuccess ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-lime-dark mx-auto mb-3" />
                  <p className="font-semibold">{dictionary.contact.success}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h3 className="font-semibold">{dictionary.catalog.orderCar}</h3>
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
      </div>
    </div>
  );
}
