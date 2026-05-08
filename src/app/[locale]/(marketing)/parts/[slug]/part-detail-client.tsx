"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Wrench, Package, CheckCircle, Clock, Loader2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { Part } from "@/types/part";

const LABELS = {
  ru: {
    oem: "Артикул OEM",
    brand: "Бренд",
    category: "Категория",
    stock: "Наличие",
    inStock: "В наличии",
    outOfStock: "Под заказ",
    fits: "Совместимость",
    yearRange: "Годы",
    inquire: "Оставить заявку",
    name: "Ваше имя",
    phone: "Телефон",
    message: "Комментарий (необязательно)",
    submit: "Отправить",
    sent: "Заявка отправлена! Мы свяжемся с вами.",
    error: "Ошибка отправки. Попробуйте позже.",
    wholesalePrice: "Оптовая цена",
    minOrder: "от",
    pcs: "шт.",
    wholesaleCtaIn: "Я оптовый покупатель",
    wholesaleCtaOut: "Скрыть оптовые цены",
    categories: {
      engine: "Двигатель", body: "Кузов", electrical: "Электрика",
      suspension: "Подвеска", brakes: "Тормоза", interior: "Салон", other: "Прочее",
    },
  },
  uz: {
    oem: "OEM raqami",
    brand: "Brend",
    category: "Kategoriya",
    stock: "Mavjudligi",
    inStock: "Mavjud",
    outOfStock: "Buyurtma asosida",
    fits: "Moslik",
    yearRange: "Yillar",
    inquire: "Ariza qoldirish",
    name: "Ismingiz",
    phone: "Telefon",
    message: "Izoh (ixtiyoriy)",
    submit: "Yuborish",
    sent: "Ariza yuborildi! Biz siz bilan bog'lanamiz.",
    error: "Yuborishda xatolik. Keyinroq qayta urinib ko'ring.",
    wholesalePrice: "Ulgurji narx",
    minOrder: "kamida",
    pcs: "dona",
    wholesaleCtaIn: "Men ulgurji xaridorman",
    wholesaleCtaOut: "Ulgurji narxlarni yashirish",
    categories: {
      engine: "Dvigatel", body: "Kuzov", electrical: "Elektrika",
      suspension: "Podveska", brakes: "Tormoz", interior: "Salon", other: "Boshqa",
    },
  },
  en: {
    oem: "OEM number",
    brand: "Brand",
    category: "Category",
    stock: "Availability",
    inStock: "In stock",
    outOfStock: "Made to order",
    fits: "Fits",
    yearRange: "Years",
    inquire: "Request this part",
    name: "Your name",
    phone: "Phone",
    message: "Message (optional)",
    submit: "Send",
    sent: "Inquiry sent! We will contact you.",
    error: "Failed to send. Try again later.",
    wholesalePrice: "Wholesale price",
    minOrder: "from",
    pcs: "pcs",
    wholesaleCtaIn: "I'm a wholesale buyer",
    wholesaleCtaOut: "Hide wholesale prices",
    categories: {
      engine: "Engine", body: "Body", electrical: "Electrical",
      suspension: "Suspension", brakes: "Brakes", interior: "Interior", other: "Other",
    },
  },
} as const;

export default function PartDetailClient({ part }: { part: Part }) {
  const { locale } = useLocale();
  const t = LABELS[locale as keyof typeof LABELS] || LABELS.ru;
  const name =
    (locale === "uz" && part.name_uz) ||
    (locale === "en" && part.name_en) ||
    part.name_ru;
  const description =
    (locale === "uz" && part.description_uz) ||
    (locale === "en" && part.description_en) ||
    part.description_ru;

  const [activeImage, setActiveImage] = useState(part.images[0] || "");
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [wholesale, setWholesale] = useState(false);

  useEffect(() => {
    // Cookie gate — persists across pages for the session.
    setWholesale(document.cookie.split("; ").some((c) => c.startsWith("tm_wholesale=1")));
  }, []);

  const toggleWholesale = () => {
    const next = !wholesale;
    document.cookie = next
      ? "tm_wholesale=1; path=/; max-age=2592000; samesite=lax"
      : "tm_wholesale=; path=/; max-age=0; samesite=lax";
    setWholesale(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          message: form.message,
          type: "part_inquiry",
          source_page: `/parts/${part.slug}`,
          metadata: {
            part_id: part.id,
            part_slug: part.slug,
            part_name: part.name_ru,
            oem_number: part.oem_number,
          },
        }),
      });
      if (res.ok) {
        setStatus("sent");
        setForm({ name: "", phone: "", message: "" });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const yearRange =
    part.fits_year_from && part.fits_year_to
      ? `${part.fits_year_from} – ${part.fits_year_to}`
      : part.fits_year_from
      ? `${part.fits_year_from}+`
      : part.fits_year_to
      ? `– ${part.fits_year_to}`
      : null;

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Gallery */}
          <div>
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#0a0a0f] border border-white/10 mb-3">
              {activeImage ? (
                <Image
                  src={activeImage}
                  alt={name}
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20">
                  <Wrench className="w-16 h-16" />
                </div>
              )}
            </div>
            {part.images.length > 1 && (
              <div className="grid grid-cols-5 gap-2">
                {part.images.map((url) => (
                  <button
                    key={url}
                    onClick={() => setActiveImage(url)}
                    className={cn(
                      "relative aspect-square rounded-lg overflow-hidden border-2 transition",
                      activeImage === url ? "border-cyan-400" : "border-white/10",
                    )}
                  >
                    <Image
                      src={url}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 80px, 20vw"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-5">
            <div>
              <Badge variant="secondary" className="mb-2 capitalize">
                {t.categories[part.category as keyof typeof t.categories] || part.category}
              </Badge>
              <h1 className="text-3xl font-bold text-white">{name}</h1>
              {part.oem_number && (
                <p className="text-sm text-white/50 font-mono mt-1">
                  {t.oem}: {part.oem_number}
                </p>
              )}
            </div>

            <div className="flex items-baseline gap-3">
              {part.price_usd ? (
                <span className="text-4xl font-bold text-white">${part.price_usd}</span>
              ) : (
                <span className="text-xl text-white/60">По запросу</span>
              )}
              {part.original_price_usd && part.original_price_usd > (part.price_usd || 0) && (
                <span className="text-lg text-white/40 line-through">${part.original_price_usd}</span>
              )}
            </div>

            {part.wholesale_price_usd != null && (
              <div>
                {wholesale ? (
                  <div className="rounded-xl border border-cyan-400/40 bg-cyan-400/5 p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-cyan-400" />
                      <div>
                        <p className="text-xs text-white/50">{t.wholesalePrice}</p>
                        <p className="text-xl font-bold text-cyan-300">
                          ${part.wholesale_price_usd}{" "}
                          <span className="text-xs text-white/50 font-normal">
                            · {t.minOrder} {part.min_order_qty} {t.pcs}
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={toggleWholesale}
                      className="text-xs text-white/50 hover:text-white underline"
                    >
                      {t.wholesaleCtaOut}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={toggleWholesale}
                    className="inline-flex items-center gap-2 text-xs text-cyan-300 hover:text-cyan-200 underline"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    {t.wholesaleCtaIn}
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              {part.brand && (
                <div className="bg-[#0d0d15] rounded-xl p-3 border border-white/5">
                  <p className="text-white/40 text-xs mb-0.5">{t.brand}</p>
                  <p className="text-white font-medium">{part.brand}</p>
                </div>
              )}
              <div className="bg-[#0d0d15] rounded-xl p-3 border border-white/5">
                <p className="text-white/40 text-xs mb-0.5">{t.stock}</p>
                <p className={cn("font-medium flex items-center gap-1", part.stock_qty > 0 ? "text-green-400" : "text-white/60")}>
                  {part.stock_qty > 0 ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  {part.stock_qty > 0 ? t.inStock : t.outOfStock}
                </p>
              </div>
            </div>

            {(part.fits_brands.length > 0 || part.fits_models.length > 0 || yearRange) && (
              <div className="bg-[#0d0d15] rounded-xl p-4 border border-white/5 space-y-2">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {t.fits}
                </p>
                {part.fits_brands.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {part.fits_brands.map((b) => (
                      <Badge key={b} variant="outline">{b}</Badge>
                    ))}
                  </div>
                )}
                {part.fits_models.length > 0 && (
                  <p className="text-sm text-white/70">{part.fits_models.join(" · ")}</p>
                )}
                {yearRange && <p className="text-sm text-white/50">{t.yearRange}: {yearRange}</p>}
              </div>
            )}

            {description && (
              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                {description}
              </p>
            )}

            {/* Inquiry form */}
            <form onSubmit={submit} className="bg-[#0d0d15] rounded-2xl p-5 border border-white/10 space-y-3">
              <h3 className="font-semibold text-white">{t.inquire}</h3>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t.name}
                required
              />
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder={t.phone}
                type="tel"
                required
              />
              <textarea
                className="w-full px-3 py-2 rounded-xl bg-[#050508] border border-white/10 text-sm text-white min-h-[70px]"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder={t.message}
              />
              <Button type="submit" disabled={status === "sending"} className="w-full">
                {status === "sending" && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {t.submit}
              </Button>
              {status === "sent" && <p className="text-xs text-green-400">{t.sent}</p>}
              {status === "error" && <p className="text-xs text-red-400">{t.error}</p>}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
