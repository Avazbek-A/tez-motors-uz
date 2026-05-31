"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search, ShoppingCart, Ship, FileCheck, Wrench, Shield,
  Calculator, Truck, ClipboardCheck, Headphones, ArrowRight, CheckCircle, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { cn } from "@/lib/utils";
import { Turnstile } from "@/components/shared/turnstile";

const services = {
  ru: [
    { icon: Search, title: "Подбор автомобиля", desc: "Подберём автомобиль по вашим критериям: бренд, бюджет, комплектация, цвет. Доступ к тысячам авто на аукционах и у дилеров Китая.", color: "bg-primary/10 text-primary" },
    { icon: ClipboardCheck, title: "Проверка и диагностика", desc: "Полная проверка истории автомобиля, VIN-кода, техническая диагностика. Фото и видео отчёт перед покупкой.", color: "bg-white/5 text-foreground" },
    { icon: ShoppingCart, title: "Выкуп автомобиля", desc: "Выкупаем автомобиль на аукционе или у дилера по лучшей цене. Гарантируем безопасность сделки.", color: "bg-white/5 text-foreground" },
    { icon: Ship, title: "Международная доставка", desc: "Доставка морем, по железной дороге или автовозом. Страхование груза на всё время перевозки.", color: "bg-white/5 text-foreground" },
    { icon: FileCheck, title: "Таможенное оформление", desc: "Полное таможенное оформление: расчёт пошлин, подготовка документов, получение сертификата соответствия.", color: "bg-white/5 text-foreground" },
    { icon: Truck, title: "Доставка до двери", desc: "Доставим автомобиль до вашего города в Узбекистане. Работаем с Ташкентом и регионами.", color: "bg-white/5 text-foreground" },
    { icon: Wrench, title: "Техобслуживание", desc: "Помощь с первичным ТО, настройка бортового ПО, перевод интерфейса на русский/узбекский язык.", color: "bg-white/5 text-foreground" },
    { icon: Shield, title: "Гарантия и поддержка", desc: "Гарантия 1 год / 20 000 км. Консультации после покупки. Помощь с запчастями и сервисом.", color: "bg-white/5 text-foreground" },
    { icon: Calculator, title: "Расчёт стоимости", desc: "Бесплатный расчёт полной стоимости импорта: цена авто, пошлины, доставка, наша комиссия.", color: "bg-white/5 text-foreground" },
    { icon: Headphones, title: "Персональный менеджер", desc: "Выделенный менеджер на всех этапах сделки. Связь через Telegram, WhatsApp, телефон.", color: "bg-primary/10 text-primary" },
  ],
  en: [
    { icon: Search, title: "Car Selection", desc: "We'll find a car matching your criteria: brand, budget, trim, color. Access to thousands of vehicles from Chinese auctions and dealers.", color: "bg-primary/10 text-primary" },
    { icon: ClipboardCheck, title: "Inspection & Diagnostics", desc: "Complete vehicle history check, VIN verification, technical diagnostics. Photo and video report before purchase.", color: "bg-white/5 text-foreground" },
    { icon: ShoppingCart, title: "Vehicle Purchase", desc: "We purchase the vehicle at auction or from dealer at the best price. Transaction security guaranteed.", color: "bg-white/5 text-foreground" },
    { icon: Ship, title: "International Shipping", desc: "Delivery by sea, rail, or car carrier. Cargo insurance throughout the entire transit.", color: "bg-white/5 text-foreground" },
    { icon: FileCheck, title: "Customs Clearance", desc: "Full customs processing: duty calculation, document preparation, conformity certification.", color: "bg-white/5 text-foreground" },
    { icon: Truck, title: "Door-to-Door Delivery", desc: "We deliver the car to your city in Uzbekistan. We serve Tashkent and all regions.", color: "bg-white/5 text-foreground" },
    { icon: Wrench, title: "Service & Setup", desc: "Help with initial service, software setup, interface translation to Russian/Uzbek.", color: "bg-white/5 text-foreground" },
    { icon: Shield, title: "Warranty & Support", desc: "1-year / 20,000 km warranty. Post-purchase consultations. Parts and service assistance.", color: "bg-white/5 text-foreground" },
    { icon: Calculator, title: "Cost Calculation", desc: "Free full import cost calculation: car price, duties, delivery, our commission.", color: "bg-white/5 text-foreground" },
    { icon: Headphones, title: "Personal Manager", desc: "Dedicated manager at all stages. Contact via Telegram, WhatsApp, phone.", color: "bg-primary/10 text-primary" },
  ],
  uz: [
    { icon: Search, title: "Avtomobil tanlash", desc: "Mezonlaringiz bo'yicha avtomobil tanlaymiz: brend, byudjet, jihozlanish, rang. Xitoy auktsionlari va dilerlaridan minglab avtomobillarga kirish.", color: "bg-primary/10 text-primary" },
    { icon: ClipboardCheck, title: "Tekshiruv va diagnostika", desc: "Avtomobil tarixini to'liq tekshirish, VIN-kod tekshiruvi, texnik diagnostika. Sotib olishdan oldin foto va video hisobot.", color: "bg-white/5 text-foreground" },
    { icon: ShoppingCart, title: "Avtomobil sotib olish", desc: "Avtomobilni auktsion yoki dilerdan eng yaxshi narxda sotib olamiz. Bitim xavfsizligi kafolatlangan.", color: "bg-white/5 text-foreground" },
    { icon: Ship, title: "Xalqaro yetkazib berish", desc: "Dengiz, temir yo'l yoki avtovoz orqali yetkazib berish. Butun tranzit davomida yuk sug'urtasi.", color: "bg-white/5 text-foreground" },
    { icon: FileCheck, title: "Bojxona rasmiylashtiruvi", desc: "To'liq bojxona rasmiylashtiruvi: boj hisoblash, hujjatlar tayyorlash, muvofiqlik sertifikati.", color: "bg-white/5 text-foreground" },
    { icon: Truck, title: "Eshikkacha yetkazib berish", desc: "Avtomobilni O'zbekistondagi shahringizga yetkazib beramiz. Toshkent va barcha viloyatlarga xizmat ko'rsatamiz.", color: "bg-white/5 text-foreground" },
    { icon: Wrench, title: "Xizmat va sozlash", desc: "Dastlabki texnik xizmat, dasturiy ta'minot sozlash, interfeysni rus/o'zbek tiliga tarjima qilishda yordam.", color: "bg-white/5 text-foreground" },
    { icon: Shield, title: "Kafolat va qo'llab-quvvatlash", desc: "1 yil / 20 000 km kafolat. Sotib olgandan keyingi maslahatlar. Ehtiyot qismlar va xizmat ko'rsatish yordami.", color: "bg-white/5 text-foreground" },
    { icon: Calculator, title: "Narx hisoblash", desc: "Import narxini to'liq bepul hisoblash: avtomobil narxi, bojlar, yetkazib berish, bizning komissiya.", color: "bg-white/5 text-foreground" },
    { icon: Headphones, title: "Shaxsiy menejer", desc: "Barcha bosqichlarda maxsus menejer. Telegram, WhatsApp, telefon orqali aloqa.", color: "bg-primary/10 text-primary" },
  ],
};

export default function ServicesContent() {
  const { locale } = useLocale();
  const { ref, isVisible } = useScrollReveal();
  const items = services[locale as keyof typeof services] || services.ru;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceType, setServiceType] = useState("Inspection");
  const [makeModel, setMakeModel] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const title = locale === "ru" ? "Наши услуги" : locale === "uz" ? "Bizning xizmatlarimiz" : "Our Services";
  const subtitle = locale === "ru"
    ? "Полный спектр услуг по импорту автомобилей из Китая"
    : locale === "uz" ? "Xitoydan avtomobil importi bo'yicha xizmatlarning to'liq spektri"
    : "Full range of car import services from China";

  const bookingLabels = {
    ru: {
      title: "Заявка на сервис",
      subtitle: "Оставьте заявку, и менеджер свяжется с вами для согласования даты.",
      serviceType: "Тип услуги",
      makeModel: "Марка и модель",
      preferredDate: "Желаемая дата",
      notes: "Комментарий",
      submit: "Записаться",
      success: "Заявка отправлена",
    },
    uz: {
      title: "Servis uchun ariza",
      subtitle: "Ariza qoldiring, menejer sana bo'yicha siz bilan bog'lanadi.",
      serviceType: "Xizmat turi",
      makeModel: "Marka va model",
      preferredDate: "Istalgan sana",
      notes: "Izoh",
      submit: "Yozilish",
      success: "Ariza yuborildi",
    },
    en: {
      title: "Service Booking",
      subtitle: "Submit a request and a manager will contact you to confirm the date.",
      serviceType: "Service type",
      makeModel: "Make and model",
      preferredDate: "Preferred date",
      notes: "Notes",
      submit: "Book service",
      success: "Request sent",
    },
  } as const;
  const b = bookingLabels[locale as keyof typeof bookingLabels] || bookingLabels.ru;

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          type: "service",
          message: notes || `${serviceType}${preferredDate ? ` | ${preferredDate}` : ""}`,
          metadata: { service_type: serviceType, make_model: makeModel, preferred_date: preferredDate },
          source_page: "/services",
          turnstile_token: turnstileToken ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSubmitError(data.error || "Failed to submit");
        return;
      }
      setSubmitSuccess(true);
      setServiceType("Inspection");
      setName("");
      setPhone("");
      setMakeModel("");
      setPreferredDate("");
      setNotes("");
      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch {
      setSubmitError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading title={title} subtitle={subtitle} />

        <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {items.map((service, index) => {
            const Icon = service.icon;
            return (
              <div
                key={index}
                className={`bg-card rounded-2xl border border-border p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 ${
                  isVisible ? "animate-fade-in-up" : "opacity-0"
                }`}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-5", service.color)}>
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{service.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{service.desc}</p>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="bg-primary rounded-3xl p-10 md:p-14 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground mb-4">
            {locale === "ru" ? "Готовы начать?" : locale === "uz" ? "Boshlashga tayyormisiz?" : "Ready to Start?"}
          </h2>
          <p className="text-primary-foreground/70 mb-8 max-w-lg mx-auto">
            {locale === "ru"
              ? "Оставьте заявку и получите бесплатную консультацию по импорту автомобиля из Китая"
              : "Submit a request and get a free consultation on importing a car from China"}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="xl" variant="secondary" asChild>
              <Link href={localizedPath(locale, "/contacts")}>
                {locale === "ru" ? "Оставить заявку" : "Get Started"}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button size="xl" variant="outline" className="border-white/30 text-white hover:bg-white/10 hover:text-white" asChild>
              <Link href={localizedPath(locale, "/calculator")}>
                <Calculator className="w-5 h-5" />
                {locale === "ru" ? "Рассчитать стоимость" : "Calculate Cost"}
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-16 max-w-3xl mx-auto bg-card border border-border rounded-3xl p-8">
          {submitSuccess ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-neon-green mx-auto mb-3" />
              <p className="font-semibold text-foreground">{b.success}</p>
            </div>
          ) : (
            <form onSubmit={handleBooking} className="space-y-4">
              <div>
                <h3 className="text-2xl font-bold text-foreground">{b.title}</h3>
                <p className="text-muted-foreground mt-1">{b.subtitle}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={locale === "ru" ? "Ваше имя" : locale === "uz" ? "Ismingiz" : "Your name"} />
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={locale === "ru" ? "Телефон" : locale === "uz" ? "Telefon" : "Phone"} />
                <Input value={serviceType} onChange={(e) => setServiceType(e.target.value)} placeholder={b.serviceType} />
                <Input value={makeModel} onChange={(e) => setMakeModel(e.target.value)} placeholder={b.makeModel} />
                <Input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} placeholder={b.preferredDate} />
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={b.notes} />
              </div>
              <Turnstile onToken={setTurnstileToken} />
              {submitError && <p className="text-sm text-neon-pink">{submitError}</p>}
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : b.submit}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
