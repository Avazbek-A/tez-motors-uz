"use client";

import { useParams } from "next/navigation";
import { CarVideo } from "@/components/car/car-video";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Fuel, Gauge, Settings2, CarFront, Palette, Calendar,
  Zap, Send, Loader2, CheckCircle, Info, AlertCircle, Wrench, MessageCircle
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
import { track, FUNNEL } from "@/lib/analytics";
import { formatPrice, whatsappLink, telegramLink } from "@/lib/utils";
import { estimatedMonthlyFrom, FINANCE_DEFAULTS } from "@/lib/finance";
import { localizedPath } from "@/lib/locale-path";
import { useSiteSettings } from "@/lib/site-settings-context";
import type { Car } from "@/types/car";
import { Turnstile } from "@/components/shared/turnstile";
import { ReservationModal } from "@/components/car/reservation-modal";
import { TestDriveModal } from "@/components/car/test-drive-modal";

export default function CarDetailPage() {
  const params = useParams();
  const { locale, dictionary } = useLocale();
  const { addViewed } = useRecentlyViewed();
  const settings = useSiteSettings();

  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showReserve, setShowReserve] = useState(false);
  const [showTestDrive, setShowTestDrive] = useState(false);
  const [financing, setFinancing] = useState(false);

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

  const waMessage =
    locale === "ru"
      ? `Здравствуйте! Интересует ${car.brand} ${car.model} ${car.year} (${formatPrice(car.price_usd)}). Подскажите по наличию и условиям.`
      : locale === "uz"
      ? `Assalomu alaykum! ${car.brand} ${car.model} ${car.year} (${formatPrice(car.price_usd)}) qiziqtiryapti. Mavjudligi va shartlari bo'yicha ma'lumot bering.`
      : `Hello! I'm interested in the ${car.brand} ${car.model} ${car.year} (${formatPrice(car.price_usd)}). Could you share availability and terms?`;
  const waHref = whatsappLink(settings.whatsapp, waMessage);
  const tgHref = telegramLink(settings.telegram);

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
          // Financing requests reuse the "calculator" inquiry type (no new DB
          // CHECK migration) and carry the assumed terms in metadata so the
          // dealer sees the estimate the customer was shown.
          type: financing ? "calculator" : "car_inquiry",
          car_id: car.id,
          source_page: `/catalog/${car.slug}`,
          locale,
          ...(financing
            ? {
                metadata: {
                  financing: true,
                  estimated_monthly_usd: estimatedMonthlyFrom(car.price_usd),
                  down_payment_pct: FINANCE_DEFAULTS.downPaymentPct,
                  term_months: FINANCE_DEFAULTS.termMonths,
                  annual_rate_pct: FINANCE_DEFAULTS.annualRatePct,
                },
              }
            : {}),
          turnstile_token: turnstileToken ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error || (locale === "ru" ? "Ошибка отправки. Попробуйте ещё раз." : "Failed to send. Please try again."));
        return;
      }
      setIsSuccess(true);
      track(FUNNEL.inquirySubmit, { type: financing ? "financing" : "car_inquiry" });
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
    // Used-car disclosures (shown only for pre-owned listings).
    ...(car.listing_type === "used" && car.mileage ? [{ icon: Gauge, label: locale === "ru" ? "Пробег" : "Mileage", value: `${car.mileage.toLocaleString("en-US")} ${locale === "ru" ? "км" : "km"}` }] : []),
    ...(car.listing_type === "used" && car.owners_count != null ? [{ icon: CarFront, label: locale === "ru" ? "Владельцев" : "Owners", value: String(car.owners_count) }] : []),
    ...(car.listing_type === "used" && car.condition_grade ? [{ icon: Settings2, label: locale === "ru" ? "Состояние" : "Condition", value: car.condition_grade }] : []),
    ...(car.listing_type === "used" && car.accident_free ? [{ icon: Calendar, label: locale === "ru" ? "Без ДТП" : "Accident-free", value: locale === "ru" ? "Да" : "Yes" }] : []),
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
              <div className="bg-card rounded-2xl border border-white/10 overflow-hidden animate-fade-in-up" style={{ animationDelay: "120ms" }}>
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

            {car.spec_data?.pano_id && (
              <div className="bg-card rounded-2xl border border-white/10 overflow-hidden animate-fade-in-up" style={{ animationDelay: "110ms" }}>
                <div className="flex items-center gap-2 px-4 pt-4 pb-2 text-white font-bold text-lg">
                  <span className="text-neon-blue">360°</span>
                  {locale === "ru" ? "Обзор" : locale === "uz" ? "Ko‘rinish" : "Walkthrough"}
                </div>
                <div className="aspect-video">
                  <iframe
                    title={`${car.brand} ${car.model} 360`}
                    src={`https://pano.autohome.com.cn/car/pano/${car.spec_data.pano_id}?_ahrotate=1`}
                    className="w-full h-full"
                    loading="lazy"
                    allow="accelerometer; gyroscope; fullscreen"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            {car.spec_data?.video_mid && (
              <div className="bg-card rounded-2xl border border-white/10 overflow-hidden animate-fade-in-up" style={{ animationDelay: "115ms" }}>
                <div className="flex items-center gap-2 px-4 pt-4 pb-2 text-white font-bold text-lg">
                  <span className="text-neon-blue">▶</span>
                  {locale === "ru" ? "Видеообзор" : locale === "uz" ? "Video sharh" : "Video overview"}
                </div>
                <div className="aspect-video">
                  <CarVideo
                    mid={car.spec_data.video_mid}
                    poster={Array.isArray(car.images) ? car.images[0] : undefined}
                    subLangs={Object.keys(car.spec_data.subtitles ?? {})}
                    defaultLang={locale}
                  />
                </div>
              </div>
            )}

            {description && (
              <div className="bg-card rounded-2xl border border-white/10 p-6 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
                <h2 className="font-bold text-lg mb-3 flex items-center gap-2 text-white">
                  <Info className="w-5 h-5 text-neon-blue" />
                  {locale === "ru" ? "Описание" : locale === "uz" ? "Tavsif" : "Description"}
                </h2>
                <p className="text-white/60 leading-relaxed">{description}</p>
              </div>
            )}

            <div className="bg-card rounded-2xl border border-white/10 p-6 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
              <h2 className="font-bold text-lg mb-4 text-white">
                {locale === "ru" ? "Характеристики" : locale === "uz" ? "Xususiyatlar" : "Specifications"}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {specs.map((spec, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                    <spec.icon className="w-5 h-5 text-neon-blue shrink-0" />
                    <div>
                      <p className="text-xs text-white/60 uppercase tracking-wider">{spec.label}</p>
                      <p className="text-sm font-mono font-semibold">{spec.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {Object.keys(car.specs).length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(car.specs).map(([key, value]) => (
                    <div key={key} className="p-3 rounded-xl bg-white/5">
                      <p className="text-xs text-white/60 capitalize">{key.replace(/_/g, " ")}</p>
                      <p className="text-sm font-mono font-semibold">{String(value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card rounded-2xl border border-white/10 p-6 sticky top-24 animate-slide-in-right">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  {car.listing_type === "used" ? <Badge variant="warning">{locale === "ru" ? "С пробегом" : locale === "uz" ? "Probegli" : "Used"}</Badge> : car.mileage === 0 && <Badge>New</Badge>}
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
                    <p className="text-3xl font-mono font-bold text-neon-blue">
                      {formatPrice(car.price_usd)} <span className="text-sm text-amber-300">-{discount}%</span>
                    </p>
                  </>
                ) : (
                  <p className="text-3xl font-mono font-bold text-neon-blue">{formatPrice(car.price_usd)}</p>
                )}
                {car.price_uzs && (
                  <p className="text-sm text-white/60 mt-1">
                    ~ {formatPrice(car.price_uzs, "UZS")}
                  </p>
                )}
                {car.price_usd > 0 && (
                  <p className="text-xs text-white/70 mt-2">
                    {dictionary.common.from}{" "}
                    <span className="font-semibold text-white">
                      {formatPrice(estimatedMonthlyFrom(car.price_usd))}{dictionary.common.perMonth}
                    </span>
                  </p>
                )}
              </div>

              {car.price_usd > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mb-4"
                  onClick={() => {
                    setFinancing(true);
                    const monthly = formatPrice(estimatedMonthlyFrom(car.price_usd));
                    const msg =
                      locale === "ru"
                        ? `Интересует рассрочка на ${car.brand} ${car.model} ${car.year} (примерно ${monthly}${dictionary.common.perMonth}).`
                        : locale === "uz"
                        ? `${car.brand} ${car.model} ${car.year} uchun bo'lib to'lash qiziqtiryapti (taxminan ${monthly}${dictionary.common.perMonth}).`
                        : `I'm interested in financing the ${car.brand} ${car.model} ${car.year} (about ${monthly}${dictionary.common.perMonth}).`;
                    setForm((f) => ({ ...f, message: msg }));
                  }}
                >
                  {dictionary.common.requestFinancing}
                </Button>
              )}

              {/* Telegram is the primary contact CTA in Uzbekistan; WhatsApp is a
                  secondary text link beneath. (Telegram t.me links can't carry a
                  prefilled message — they just open the chat.) */}
              {tgHref && (
                <a
                  href={tgHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full h-12 mb-2 rounded-xl bg-[#229ED9] hover:bg-[#1c8abf] text-white font-semibold transition-colors"
                >
                  <Send className="w-5 h-5" />
                  {locale === "ru" ? "Написать в Telegram" : locale === "uz" ? "Telegram'da yozish" : "Chat on Telegram"}
                </a>
              )}
              {waHref && (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full mb-4 text-sm text-white/60 hover:text-white transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  {locale === "ru" ? "или в WhatsApp" : locale === "uz" ? "yoki WhatsAppda" : "or on WhatsApp"}
                </a>
              )}

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
              {car.spec_data && (car.spec_data.trims?.length ?? 0) > 0 && (
                <Button type="button" asChild className="w-full mb-4">
                  <Link href={localizedPath(locale, `/catalog/${car.slug}/spec`)}>
                    {locale === "uz" ? "To'liq texnik tavsif" : locale === "en" ? "View full spec sheet" : "Полная спецификация"}
                  </Link>
                </Button>
              )}
              <Button type="button" variant="outline" asChild className="w-full mb-4">
                <a href={`/api/cars/${car.id}/spec-sheet?locale=${locale}`} download>
                  Download PDF spec sheet
                </a>
              </Button>
              <Button type="button" variant="outline" asChild className="w-full mb-4">
                <Link
                  href={localizedPath(
                    locale,
                    `/parts?fits_brand=${encodeURIComponent(car.brand)}&fits_model=${encodeURIComponent(car.model)}&year=${car.year}`,
                  )}
                >
                  <Wrench className="w-4 h-4 mr-2" />
                  {locale === "uz"
                    ? "Ushbu avtomobil uchun ehtiyot qismlar"
                    : locale === "en"
                    ? "Shop parts for this car"
                    : "Запчасти для этого авто"}
                </Link>
              </Button>
              {/* High intent: viewing a model but wanting a different spec → import it to order. */}
              <Button type="button" variant="outline" asChild className="w-full mb-4">
                <Link href={localizedPath(locale, `/order?brand=${encodeURIComponent(car.brand)}`)}>
                  {locale === "uz"
                    ? "Boshqa rang yoki komplektatsiya kerakmi? Buyurtma bering →"
                    : locale === "en"
                    ? "Want a different colour or trim? Order it →"
                    : "Нужен другой цвет или комплектация? Заказать →"}
                </Link>
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
