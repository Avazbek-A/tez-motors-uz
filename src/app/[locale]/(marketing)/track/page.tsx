"use client";

import { useState } from "react";
import { Search, Package, Truck, CheckCircle, Clock, Ship, FileCheck, PhoneCall, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { cn } from "@/lib/utils";

const statusSteps = [
  { key: "new", icon: FileCheck, label: { ru: "Заявка получена", uz: "Ariza qabul qilindi", en: "Application Received" } },
  { key: "contacted", icon: PhoneCall, label: { ru: "Менеджер связался", uz: "Menejer bog'landi", en: "Manager Contacted" } },
  { key: "in_progress", icon: Ship, label: { ru: "В обработке", uz: "Jarayonda", en: "In Progress" } },
  { key: "closed", icon: CheckCircle, label: { ru: "Завершено", uz: "Yakunlandi", en: "Completed" } },
];

const statusIndex: Record<string, number> = {
  new: 0,
  contacted: 1,
  in_progress: 2,
  closed: 3,
};

const typeLabels: Record<string, Record<string, string>> = {
  inquiry: { ru: "Заявка на авто", uz: "Avto so'rovi", en: "Car Inquiry" },
  car_inquiry: { ru: "Заявка на авто", uz: "Avto so'rovi", en: "Car Inquiry" },
  callback: { ru: "Обратный звонок", uz: "Qayta qo'ng'iroq", en: "Callback" },
  test_drive: { ru: "Тест-драйв", uz: "Test-drive", en: "Test Drive" },
  reservation: { ru: "Бронь", uz: "Band qilish", en: "Reservation" },
  trade_in: { ru: "Trade-in", uz: "Trade-in", en: "Trade-in" },
  newsletter: { ru: "Подписка", uz: "Obuna", en: "Newsletter" },
  price_drop: { ru: "Снижение цены", uz: "Narx tushishi", en: "Price Drop" },
  general: { ru: "Заявка", uz: "Ariza", en: "Inquiry" },
  service: { ru: "Сервис", uz: "Servis", en: "Service" },
  part_inquiry: { ru: "Запчасть", uz: "Ehtiyot qism", en: "Part inquiry" },
};

interface Inquiry {
  id: string;
  name: string;
  phone: string;
  type: string;
  status: string;
  message: string | null;
  created_at: string;
  car: { brand: string; model: string; year: number } | null;
}

const LABELS = {
  ru: {
    title: "Статус заявки",
    subtitle: "Введите номер телефона, чтобы узнать статус вашей заявки",
    phonePlaceholder: "Ваш номер телефона (напр. +998901234567)",
    search: "Найти",
    notFound: "Заявки по этому номеру не найдены.",
    notFoundHint: "Убедитесь, что ввели правильный номер телефона",
    currentStatus: "Текущий статус",
    helpText: "Отслеживайте статус вашей заявки в реальном времени",
  },
  uz: {
    title: "Ariza holati",
    subtitle: "Arizangiz holatini bilish uchun telefon raqamingizni kiriting",
    phonePlaceholder: "Telefon raqamingiz (masalan +998901234567)",
    search: "Qidirish",
    notFound: "Bu raqam bo'yicha arizalar topilmadi.",
    notFoundHint: "Telefon raqamini to'g'ri kiritganingizga ishonch hosil qiling",
    currentStatus: "Joriy holat",
    helpText: "Arizangiz holatini real vaqtda kuzating",
  },
  en: {
    title: "Application Status",
    subtitle: "Enter your phone number to check your application status",
    phonePlaceholder: "Your phone number (e.g. +998901234567)",
    search: "Search",
    notFound: "No applications found for this number.",
    notFoundHint: "Make sure you entered the correct phone number",
    currentStatus: "Current status",
    helpText: "Track your application status in real time",
  },
} as const;

export default function TrackOrderPage() {
  const { locale } = useLocale();
  const t = LABELS[locale as keyof typeof LABELS] || LABELS.ru;
  const [phone, setPhone] = useState("");
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const title = t.title;
  const subtitle = t.subtitle;
  const dateLocale = locale === "ru" ? "ru-RU" : locale === "uz" ? "uz-UZ" : "en-US";

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNotFound(false);
    setInquiries([]);
    setSearched(false);

    try {
      const res = await fetch(
        `/api/track?phone=${encodeURIComponent(phone.trim())}`
      );
      const data = await res.json();

      if (data.success) {
        setSearched(true);
        if (data.inquiries.length === 0) {
          setNotFound(true);
        } else {
          setInquiries(data.inquiries);
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

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading as="h1" title={title} subtitle={subtitle} />

        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSearch} className="flex gap-3 mb-12">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t.phonePlaceholder}
                className="pl-12 h-14 text-base rounded-2xl"
                required
                type="tel"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="rounded-2xl px-8"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                t.search
              )}
            </Button>
          </form>

          {notFound && searched && (
            <div className="text-center py-12 bg-[#0a0a0f] rounded-2xl border border-white/10">
              <Package className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/60 text-sm">{t.notFound}</p>
              <p className="text-xs text-white/40 mt-2">{t.notFoundHint}</p>
            </div>
          )}

          {inquiries.length > 0 && (
            <div className="space-y-6 animate-fade-in-up">
              {inquiries.map((inquiry) => {
                const stepIdx = statusIndex[inquiry.status] ?? 0;
                const typeLabel =
                  typeLabels[inquiry.type]?.[locale] ?? inquiry.type;

                return (
                  <div
                    key={inquiry.id}
                    className="bg-[#0d0d15] rounded-2xl border border-white/10 overflow-hidden"
                  >
                    {/* Header */}
                    <div className="p-5 border-b border-white/10">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-white/[0.06] text-white/60 mb-2">
                            {typeLabel}
                          </span>
                          <p className="font-semibold text-white">
                            {inquiry.car
                              ? `${inquiry.car.brand} ${inquiry.car.model} ${inquiry.car.year}`
                              : inquiry.name}
                          </p>
                          {inquiry.message && (
                            <p className="text-sm text-white/50 mt-1 flex items-start gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              {inquiry.message}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-white/40 shrink-0">
                          {new Date(inquiry.created_at).toLocaleDateString(dateLocale)}
                        </p>
                      </div>
                    </div>

                    {/* Status timeline */}
                    <div className="p-5">
                      <div className="space-y-0">
                        {statusSteps.map((step, index) => {
                          const isComplete = index < stepIdx;
                          const isCurrent = index === stepIdx;
                          const Icon = step.icon;
                          return (
                            <div
                              key={step.key}
                              className="flex items-start gap-4"
                            >
                              <div className="flex flex-col items-center">
                                <div
                                  className={cn(
                                    "w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all",
                                    isComplete
                                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                                      : isCurrent
                                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/40 animate-pulse"
                                      : "bg-white/[0.04] text-white/30 border border-white/[0.08]"
                                  )}
                                >
                                  <Icon className="w-4 h-4" />
                                </div>
                                {index < statusSteps.length - 1 && (
                                  <div
                                    className={cn(
                                      "w-px h-10",
                                      isComplete
                                        ? "bg-cyan-500/30"
                                        : "bg-white/[0.06]"
                                    )}
                                  />
                                )}
                              </div>
                              <div className="pt-1.5 pb-2">
                                <p
                                  className={cn(
                                    "font-medium text-sm",
                                    isComplete || isCurrent
                                      ? "text-white"
                                      : "text-white/30"
                                  )}
                                >
                                  {step.label[locale as keyof typeof step.label]}
                                </p>
                                {isCurrent && (
                                  <p className="text-xs text-purple-400 mt-0.5">{t.currentStatus}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
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
