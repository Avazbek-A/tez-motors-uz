"use client";

import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Fuel, Gauge, Settings2, CarFront, Palette, Calendar,
  Zap, Send, Loader2, CheckCircle, Info, AlertCircle, Wrench, MessageCircle, Layers, Calculator
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/i18n/locale-context";
import { CarColorsGallery } from "@/components/catalog/car-colors-gallery";
// Heavy, interactive, below-the-gallery widgets — code-split so they don't ship in
// the initial bundle (no SEO value; only mounted when the car has video/360).
const CarVideo = dynamic(() => import("@/components/car/car-video").then((m) => m.CarVideo), { ssr: false });
const Car360 = dynamic(() => import("@/components/car/car-360").then((m) => m.Car360), { ssr: false });
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
  const [financing, setFinancing] = useState(false);
  const [aiReply, setAiReply] = useState<string | null>(null);

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
        <p className="text-muted-foreground">{locale === "ru" ? "Загрузка..." : "Loading..."}</p>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="pt-32 pb-16 text-center container-custom max-w-md mx-auto">
        <div className="text-6xl font-black text-foreground/[0.04] mb-6">404</div>
        <h1 className="text-xl font-bold mb-3 text-foreground">
          {locale === "ru" ? "Автомобиль не найден" : locale === "uz" ? "Avtomobil topilmadi" : "Car not found"}
        </h1>
        <p className="text-muted-foreground text-sm mb-8">
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
  // Guard price_usd > 0: a "price on request" car (price_usd === 0) with an
  // original_price set must NOT render a bogus "-100%" + "—" headline.
  const discount = car.price_usd > 0 && car.original_price_usd && car.original_price_usd > car.price_usd
    ? Math.round((1 - car.price_usd / car.original_price_usd) * 100)
    : 0;

  const waMessage =
    locale === "ru"
      ? `Здравствуйте! Интересует ${car.brand} ${car.model} ${car.year} (${car.price_usd > 0 ? formatPrice(car.price_usd) : dictionary.common.priceOnRequest}). Подскажите по наличию и условиям.`
      : locale === "uz"
      ? `Assalomu alaykum! ${car.brand} ${car.model} ${car.year} (${car.price_usd > 0 ? formatPrice(car.price_usd) : dictionary.common.priceOnRequest}) qiziqtiryapti. Mavjudligi va shartlari bo'yicha ma'lumot bering.`
      : `Hello! I'm interested in the ${car.brand} ${car.model} ${car.year} (${car.price_usd > 0 ? formatPrice(car.price_usd) : dictionary.common.priceOnRequest}). Could you share availability and terms?`;
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error || (locale === "ru" ? "Ошибка отправки. Попробуйте ещё раз." : "Failed to send. Please try again."));
        return;
      }
      setAiReply(typeof data.autoReply === "string" ? data.autoReply : null);
      setIsSuccess(true);
      track(FUNNEL.inquirySubmit, { type: financing ? "financing" : "car_inquiry" });
      setForm({ name: "", phone: "", message: "" });
      // Keep the AI answer on screen to read; only auto-dismiss the plain thank-you.
      if (!data.autoReply) setTimeout(() => setIsSuccess(false), 5000);
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
    <div className="pt-24 pb-28 lg:pb-16">
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
              <CarColorsGallery
                images={car.images}
                exteriorColors={car.spec_data?.exterior_colors}
                interiorColors={car.spec_data?.interior_colors}
                brand={car.brand}
                model={car.model}
                locale={locale}
                hasPano={!!car.spec_data?.pano_id}
              />
            </div>

            {car.video_url && (
              <div className="bg-card rounded-2xl border border-border overflow-hidden animate-fade-in-up" style={{ animationDelay: "120ms" }}>
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
              <div id="car-360" className="bg-card rounded-2xl border border-border overflow-hidden animate-fade-in-up scroll-mt-24" style={{ animationDelay: "110ms" }}>
                <div className="flex items-center gap-2 px-4 pt-4 pb-2 text-foreground font-bold text-lg">
                  <span className="text-neon-blue">360°</span>
                  {locale === "ru" ? "Обзор" : locale === "uz" ? "Ko‘rinish" : "Walkthrough"}
                </div>
                <div className="aspect-video">
                  <Car360
                    panoId={car.spec_data.pano_id}
                    poster={Array.isArray(car.images) ? car.images[0] : undefined}
                    locale={locale}
                  />
                </div>
              </div>
            )}

            {car.spec_data?.video_mid && (
              <div className="bg-card rounded-2xl border border-border overflow-hidden animate-fade-in-up" style={{ animationDelay: "115ms" }}>
                <div className="flex items-center gap-2 px-4 pt-4 pb-2 text-foreground font-bold text-lg">
                  <span className="text-neon-blue">▶</span>
                  {locale === "ru" ? "Видеообзор" : locale === "uz" ? "Video sharh" : "Video overview"}
                </div>
                <div className="aspect-video">
                  <CarVideo
                    mid={car.spec_data.video_mid}
                    poster={Array.isArray(car.images) ? car.images[0] : undefined}
                    subLangs={Object.keys(car.spec_data.subtitles ?? {})}
                    defaultLang={locale}
                    cached={!!car.spec_data.video_local}
                  />
                </div>
              </div>
            )}

            {description && (
              <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
                <h2 className="font-bold text-lg mb-3 flex items-center gap-2 text-foreground">
                  <Info className="w-5 h-5 text-neon-blue" />
                  {locale === "ru" ? "Описание" : locale === "uz" ? "Tavsif" : "Description"}
                </h2>
                <p className="text-muted-foreground leading-relaxed">{description}</p>
              </div>
            )}

            <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
              <h2 className="font-bold text-lg mb-4 text-foreground">
                {locale === "ru" ? "Характеристики" : locale === "uz" ? "Xususiyatlar" : "Specifications"}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {specs.map((spec, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-foreground/5">
                    <spec.icon className="w-5 h-5 text-neon-blue shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{spec.label}</p>
                      <p className="text-sm font-mono font-semibold">{spec.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {(() => {
                // Defense-in-depth: never render internal provenance keys (source/
                // confidence/autohome_id) even if an unscrubbed specs object reaches here.
                const visibleSpecs = Object.entries(car.specs || {}).filter(
                  ([k]) => !["source", "confidence", "autohome_id"].includes(k),
                );
                return visibleSpecs.length > 0 ? (
                <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {visibleSpecs.map(([key, value]) => (
                    <div key={key} className="p-3 rounded-xl bg-foreground/5">
                      <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                      <p className="text-sm font-mono font-semibold">{String(value)}</p>
                    </div>
                  ))}
                </div>
                ) : null;
              })()}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card rounded-2xl border border-border p-6 sticky top-24 animate-slide-in-right">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  {car.listing_type === "used" ? <Badge variant="warning">{locale === "ru" ? "С пробегом" : locale === "uz" ? "Probegli" : "Used"}</Badge> : car.mileage === 0 && <Badge>New</Badge>}
                  {car.fuel_type === "electric" && <Badge variant="info">EV</Badge>}
                  {car.fuel_type === "phev" && <Badge variant="info">PHEV</Badge>}
                </div>
                <h1 className="text-2xl font-bold text-foreground">
                  {car.brand} {car.model}
                </h1>
                <p className="text-muted-foreground">{car.year}</p>
              </div>

              <div className="bg-neon-blue/10 rounded-xl p-4 mb-4">
                {car.price_usd > 0 && <p className="text-xs text-muted-foreground mb-1">{dictionary.common.from}</p>}
                {discount > 0 ? (
                  <>
                    <p className="text-sm text-foreground/45 line-through">{formatPrice(car.original_price_usd!)}</p>
                    <p className="text-3xl font-mono font-bold text-neon-blue">
                      {formatPrice(car.price_usd)} <span className="text-sm text-amber-300">-{discount}%</span>
                    </p>
                  </>
                ) : (
                  <p className="text-3xl font-mono font-bold text-neon-blue">{car.price_usd > 0 ? formatPrice(car.price_usd) : dictionary.common.priceOnRequest}</p>
                )}
                {car.price_uzs && (
                  <p className="text-sm text-muted-foreground mt-1">
                    ~ {formatPrice(car.price_uzs, "UZS")}
                  </p>
                )}
                {car.price_usd > 0 && (
                  <p className="text-xs text-foreground/70 mt-2">
                    {dictionary.common.from}{" "}
                    <span className="font-semibold text-foreground">
                      {formatPrice(estimatedMonthlyFrom(car.price_usd))}{dictionary.common.perMonth}
                    </span>
                  </p>
                )}
              </div>

              {/* Растаможка (customs) — a frequently-asked figure. Shown only when the
                  matched Gonzo page provided one; presented as an estimate (not a hard
                  all-in commitment), since CIP may or may not already bundle customs. */}
              {car.spec_data?.customs_usd ? (
                <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-4 mb-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-foreground/70">{dictionary.common.customs}</span>
                    <span className="text-xl font-mono font-bold text-amber-300">≈ {formatPrice(car.spec_data.customs_usd)}</span>
                  </div>
                  {car.price_usd > 0 && (
                    <p className="mt-1 text-xs text-foreground/55">
                      {formatPrice(car.price_usd)} + {formatPrice(car.spec_data.customs_usd)} ≈{" "}
                      <span className="font-semibold text-foreground/85">
                        {formatPrice(car.price_usd + car.spec_data.customs_usd)} {dictionary.common.allIn}
                      </span>
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-foreground/40">{dictionary.common.customsNote}</p>
                </div>
              ) : null}

              {/* High-intent bridge → full customs calculator, prefilled with this car. */}
              {car.price_usd > 0 && (
                <Link
                  href={`${localizedPath(locale, "/calculator")}?car=${car.id}`}
                  className="flex items-center justify-center gap-2 w-full mb-4 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground/90 hover:bg-foreground/5 transition-colors"
                >
                  <Calculator className="w-4 h-4" />
                  {locale === "ru" ? "Рассчитать растаможку" : locale === "uz" ? "Rastamojkani hisoblash" : "Estimate customs"}
                </Link>
              )}

              {/* Per-trim CIP-Tashkent prices (authoritative Gonzo list). */}
              {car.spec_data?.gonzo_trims?.length ? (
                <div className="rounded-xl border border-border bg-foreground/[0.02] p-4 mb-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">{dictionary.common.trimsCip}</p>
                  <ul className="space-y-1.5">
                    {car.spec_data.gonzo_trims.map((tr, i) => (
                      <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-foreground/70 truncate">{tr.label}</span>
                        <span className="font-mono font-semibold text-foreground whitespace-nowrap">{formatPrice(tr.price_usd)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Compare trims → full smart spec sheet (differences-only). */}
              {(car.spec_data?.trims?.length ?? 0) > 1 && (
                <Link
                  href={localizedPath(locale, `/catalog/${car.slug}/spec`)}
                  className="flex items-center justify-center gap-2 w-full mb-4 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground/90 hover:bg-foreground/5 transition-colors"
                >
                  <Layers className="w-4 h-4" />
                  {dictionary.common.compareTrims}
                </Link>
              )}

              {car.price_usd > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mb-4 h-auto min-h-11 whitespace-normal py-2.5 leading-snug text-center"
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
                  className="flex items-center justify-center gap-2 w-full mb-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  {locale === "ru" ? "или в WhatsApp" : locale === "uz" ? "yoki WhatsAppda" : "or on WhatsApp"}
                </a>
              )}

              <ShareButtons
                title={`${car.brand} ${car.model} ${car.year} — ${formatPrice(car.price_usd)} | Tez Motors`}
                className="mb-6 pb-4 border-b border-border"
              />

              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="text-sm text-muted-foreground">
                  {locale === "ru" ? "Сохранить в избранное" : "Save to favorites"}
                </div>
                <FavoriteButton carId={car.id} />
              </div>

              {/* Reserve is only for cars physically in Tashkent the dealer can sell now
                  (admin-toggled in_stock). For import-to-order cars it's hidden — the
                  inquiry form + contact CTAs below remain the path. */}
              {car.in_stock && car.inventory_status === "available" && (
                <Button
                  type="button"
                  className="w-full mb-4 h-auto min-h-11 whitespace-normal py-2.5 leading-snug text-center"
                  onClick={() => setShowReserve(true)}
                >
                  {locale === "uz" ? "Band qilish" : locale === "en" ? "Reserve" : "Забронировать"}
                </Button>
              )}
              {car.spec_data && (car.spec_data.trims?.length ?? 0) > 0 && (
                <Button type="button" variant="outline" asChild className="w-full mb-4 h-auto min-h-11 whitespace-normal py-2.5 leading-snug text-center">
                  <Link href={localizedPath(locale, `/catalog/${car.slug}/spec`)}>
                    {locale === "uz" ? "To'liq texnik tavsif" : locale === "en" ? "View full spec sheet" : "Полная спецификация"}
                  </Link>
                </Button>
              )}
              <Button type="button" variant="outline" asChild className="w-full mb-4 h-auto min-h-11 whitespace-normal py-2.5 leading-snug text-center">
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
              <Button type="button" variant="outline" asChild className="w-full mb-4 h-auto min-h-11 whitespace-normal py-2.5 leading-snug text-center">
                <Link href={localizedPath(locale, `/order?brand=${encodeURIComponent(car.brand)}`)}>
                  {locale === "uz"
                    ? "Boshqa rang yoki komplektatsiya kerakmi? Buyurtma bering →"
                    : locale === "en"
                    ? "Want a different colour or trim? Order it →"
                    : "Нужен другой цвет или комплектация? Заказать →"}
                </Link>
              </Button>

              {isSuccess ? (
                <div className="py-8">
                  <CheckCircle className="w-12 h-12 text-primary mx-auto mb-3" />
                  <p className="font-semibold text-center">{dictionary.contact.success}</p>
                  {aiReply && (
                    <div className="mt-4 flex gap-2.5 text-left text-sm text-muted-foreground bg-foreground/5 border border-border rounded-xl p-4">
                      <MessageCircle className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                      <p className="leading-relaxed whitespace-pre-line">{aiReply}</p>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h3 className="font-semibold">{dictionary.catalog.orderCar}</h3>
                  {car.inventory_status !== "available" && (
                    <div className="rounded-xl bg-foreground/5 border border-border p-3 text-sm text-muted-foreground">
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

      {/* Mobile sticky price + primary CTA — desktop already has the sticky
          sidebar; on phones the sidebar is far below the gallery, so surface
          price + a one-tap contact here. pr-20 clears the floating contact FAB. */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-border bg-background/95 backdrop-blur-lg px-4 py-2.5 pr-20">
        <div className="min-w-0">
          {car.price_usd > 0 ? (
            <>
              <span className="block text-[10px] uppercase tracking-wide text-muted-foreground leading-none">{dictionary.common.from}</span>
              <span className="block text-lg font-mono font-bold text-foreground truncate">{formatPrice(car.price_usd)}</span>
            </>
          ) : (
            <span className="block text-sm font-semibold text-foreground">{dictionary.common.priceOnRequest}</span>
          )}
        </div>
        {tgHref && (
          <Button asChild size="sm" className="shrink-0">
            <a href={tgHref} target="_blank" rel="noopener noreferrer">
              {locale === "ru" ? "Написать" : locale === "uz" ? "Yozish" : "Message"}
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
