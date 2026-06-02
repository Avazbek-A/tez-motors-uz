"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Package,
  Truck,
  CheckCircle,
  Clock,
  Ship,
  FileText,
  CreditCard,
  Landmark,
  PackageCheck,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/shared/section-heading";
import { DepositButton } from "@/components/checkout/deposit-button";
import { useLocale } from "@/i18n/locale-context";
import { cn } from "@/lib/utils";

// Mirrors the 7-status CHECK on public.orders (migration 017). Order matters —
// the index of the order's current status decides how far the timeline fills.
const statusSteps = [
  { key: "ordered", icon: FileText, label: { ru: "Заказ оформлен", uz: "Buyurtma rasmiylashtirildi", en: "Order placed" } },
  { key: "deposit_paid", icon: CreditCard, label: { ru: "Депозит внесён", uz: "Depozit to'landi", en: "Deposit paid" } },
  { key: "sourcing", icon: Search, label: { ru: "Поиск автомобиля", uz: "Avtomobil qidirilmoqda", en: "Sourcing" } },
  { key: "in_transit", icon: Ship, label: { ru: "В пути", uz: "Yo'lda", en: "In transit" } },
  { key: "at_customs", icon: Landmark, label: { ru: "На таможне", uz: "Bojxonada", en: "At customs" } },
  { key: "ready_for_pickup", icon: PackageCheck, label: { ru: "Готов к выдаче", uz: "Olishga tayyor", en: "Ready for pickup" } },
  { key: "delivered", icon: CheckCircle, label: { ru: "Доставлен", uz: "Yetkazildi", en: "Delivered" } },
] as const;

const statusIndex: Record<string, number> = Object.fromEntries(
  statusSteps.map((s, i) => [s.key, i]),
);

interface OrderEvent {
  status: string;
  note: string | null;
  created_at: string;
}

interface Order {
  reference_code: string;
  status: string;
  customer_name: string;
  amount_usd: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  car: { brand: string; model: string; year: number; slug: string } | null;
  events: OrderEvent[];
}

const LABELS = {
  ru: {
    title: "Отслеживание заказа",
    subtitle: "Введите номер заказа и телефон, чтобы узнать статус доставки",
    codePlaceholder: "Номер заказа (напр. TM-7K3F9Q2X)",
    phonePlaceholder: "Телефон (напр. +998901234567)",
    search: "Найти",
    notFound: "Заказ не найден.",
    notFoundHint: "Проверьте номер заказа и телефон, указанные при бронировании",
    currentStatus: "Текущий статус",
    deposit: "Депозит",
    depositPrompt: "Закрепите бронь — внесите депозит онлайн, пока автомобиль удерживается за вами.",
    receipt: "Чек / подтверждение",
    placed: "Оформлен",
    helpText: "Отслеживайте доставку вашего автомобиля от заказа до выдачи",
  },
  uz: {
    title: "Buyurtmani kuzatish",
    subtitle: "Yetkazib berish holatini bilish uchun buyurtma raqami va telefonni kiriting",
    codePlaceholder: "Buyurtma raqami (masalan TM-7K3F9Q2X)",
    phonePlaceholder: "Telefon (masalan +998901234567)",
    search: "Qidirish",
    notFound: "Buyurtma topilmadi.",
    notFoundHint: "Bron qilishda ko'rsatilgan buyurtma raqami va telefonni tekshiring",
    currentStatus: "Joriy holat",
    deposit: "Depozit",
    depositPrompt: "Bronni mustahkamlang — avtomobil siz uchun band turganida depozitni onlayn to'lang.",
    receipt: "Chek / tasdiq",
    placed: "Rasmiylashtirilgan",
    helpText: "Avtomobilingizni buyurtmadan to'liq yetkazib berilgungacha kuzating",
  },
  en: {
    title: "Track your order",
    subtitle: "Enter your order reference and phone to see the delivery status",
    codePlaceholder: "Order reference (e.g. TM-7K3F9Q2X)",
    phonePlaceholder: "Phone (e.g. +998901234567)",
    search: "Search",
    notFound: "Order not found.",
    notFoundHint: "Check the reference code and the phone number you used to reserve",
    currentStatus: "Current status",
    deposit: "Deposit",
    depositPrompt: "Secure your reservation — pay the deposit online while the car is held for you.",
    receipt: "Receipt",
    placed: "Placed",
    helpText: "Follow your car from order to handover",
  },
} as const;

export default function TrackOrderPage() {
  const { locale } = useLocale();
  const t = LABELS[locale as keyof typeof LABELS] || LABELS.ru;
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // The status-change email links to /track?code=TM-... — pre-fill the field so
  // the customer only has to add their phone. Read once on mount; avoid
  // useSearchParams to keep this page out of a Suspense boundary.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("code");
    if (c) setCode(c);
  }, []);

  const dateLocale = locale === "ru" ? "ru-RU" : locale === "uz" ? "uz-UZ" : "en-US";

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNotFound(false);
    setOrder(null);
    setSearched(false);

    try {
      const res = await fetch(
        `/api/track?code=${encodeURIComponent(code.trim())}&phone=${encodeURIComponent(phone.trim())}`,
      );
      const data = await res.json();

      if (data.success) {
        setSearched(true);
        if (!data.order) {
          setNotFound(true);
        } else {
          setOrder(data.order);
        }
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const stepIdx = order ? statusIndex[order.status] ?? 0 : 0;
  // Notes attached to a given status, keyed by step index, so we can show the
  // dealer's free-text update beneath the matching timeline row.
  const noteByStatus: Record<string, string> = {};
  if (order) {
    for (const ev of order.events) {
      if (ev.note) noteByStatus[ev.status] = ev.note;
    }
  }

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading as="h1" title={t.title} subtitle={t.subtitle} />

        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-12">
            <div className="relative flex-1">
              <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t.codePlaceholder}
                aria-label={t.codePlaceholder}
                className="pl-12 h-14 text-base font-mono"
                required
              />
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t.phonePlaceholder}
                aria-label={t.phonePlaceholder}
                className="pl-12 h-14 text-base font-mono"
                required
                type="tel"
              />
            </div>
            <Button type="submit" size="lg" className="px-8" disabled={loading}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t.search}
            </Button>
          </form>

          {notFound && searched && (
            <div className="text-center py-12 bg-card border border-border">
              <Package className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/60 text-sm">{t.notFound}</p>
              <p className="text-xs text-white/40 mt-2">{t.notFoundHint}</p>
            </div>
          )}

          {order && (
            <div className="bg-card border border-border overflow-hidden animate-fade-in-up shadow-sm">
              {/* Header */}
              <div className="p-5 border-b border-border">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="inline-block text-xs font-mono font-medium px-2.5 py-1 border border-primary/30 bg-primary/10 text-primary mb-2 tracking-[0.08em]">
                      {order.reference_code}
                    </span>
                    <p className="font-semibold text-white">
                      {order.car
                        ? `${order.car.brand} ${order.car.model} ${order.car.year}`
                        : order.customer_name}
                    </p>
                    {order.amount_usd != null && (
                      <p className="text-sm text-white/50 mt-1">
                        {t.deposit}: <span className="font-mono text-white/70">${order.amount_usd.toLocaleString()}</span>
                      </p>
                    )}
                    {order.notes && (
                      <p className="text-sm text-white/50 mt-1 flex items-start gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        {order.notes}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-white/40 shrink-0">
                    {t.placed}: <span className="font-mono">{new Date(order.created_at).toLocaleDateString(dateLocale)}</span>
                  </p>
                </div>
              </div>

              {/* Printable receipt / order confirmation (available for any found order). */}
              <div className="px-5 py-3 border-b border-border flex justify-end">
                <a
                  href={`/api/receipt?code=${encodeURIComponent(order.reference_code)}&phone=${encodeURIComponent(phone.trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.12em] text-primary hover:underline"
                >
                  <FileText className="w-3.5 h-3.5" /> {t.receipt}
                </a>
              </div>

              {/* Unpaid reservation: surface the deposit CTA so the recovery
                  reminder (→ /track) actually leads to a payment. Hidden when no
                  payment rail is configured (DepositButton returns null). */}
              {order.status === "ordered" && (
                <div className="px-5 py-4 border-b border-border bg-primary/[0.06]">
                  <p className="text-sm text-white/70 mb-3">{t.depositPrompt}</p>
                  <DepositButton referenceCode={order.reference_code} phone={phone} />
                </div>
              )}

              {/* Status timeline */}
              <div className="p-5">
                <div className="space-y-0">
                  {statusSteps.map((step, index) => {
                    const isComplete = index < stepIdx;
                    const isCurrent = index === stepIdx;
                    const Icon = step.icon;
                    const note = noteByStatus[step.key];
                    return (
                      <div key={step.key} className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              "w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all",
                              isComplete
                                ? "bg-primary/15 text-primary border border-primary/30"
                                : isCurrent
                                ? "bg-primary text-primary-foreground border border-primary"
                                : "bg-white/[0.04] text-white/30 border border-white/[0.08]",
                            )}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          {index < statusSteps.length - 1 && (
                            <div
                              className={cn(
                                "w-px h-10",
                                isComplete ? "bg-primary/30" : "bg-white/[0.06]",
                              )}
                            />
                          )}
                        </div>
                        <div className="pt-1.5 pb-2">
                          <p
                            className={cn(
                              "font-medium text-sm",
                              isComplete || isCurrent ? "text-white" : "text-white/30",
                            )}
                          >
                            {step.label[locale as keyof typeof step.label]}
                          </p>
                          {isCurrent && (
                            <p className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-primary mt-1">{t.currentStatus}</p>
                          )}
                          {note && (
                            <p className="text-xs text-white/50 mt-1">{note}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Help text */}
          {!searched && (
            <div className="text-center mt-8">
              <div className="flex items-center justify-center gap-3 text-white/30">
                <Truck className="w-5 h-5" />
                <Clock className="w-5 h-5" />
                <Ship className="w-5 h-5" />
              </div>
              <p className="text-sm text-white/30 mt-3">{t.helpText}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
