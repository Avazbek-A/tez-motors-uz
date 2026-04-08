"use client";

import Link from "next/link";
import {
  Search, ShoppingCart, Ship, FileCheck, Wrench, Shield,
  Calculator, Truck, ClipboardCheck, Headphones, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { cn } from "@/lib/utils";

const services = {
  ru: [
    { icon: Search, title: "Подбор автомобиля", desc: "Подберём автомобиль по вашим критериям: бренд, бюджет, комплектация, цвет. Доступ к тысячам авто на аукционах и у дилеров Китая.", color: "bg-blue-500/10 text-blue-600" },
    { icon: ClipboardCheck, title: "Проверка и диагностика", desc: "Полная проверка истории автомобиля, VIN-кода, техническая диагностика. Фото и видео отчёт перед покупкой.", color: "bg-green-500/10 text-green-600" },
    { icon: ShoppingCart, title: "Выкуп автомобиля", desc: "Выкупаем автомобиль на аукционе или у дилера по лучшей цене. Гарантируем безопасность сделки.", color: "bg-amber-500/10 text-amber-600" },
    { icon: Ship, title: "Международная доставка", desc: "Доставка морем, по железной дороге или автовозом. Страхование груза на всё время перевозки.", color: "bg-purple-500/10 text-purple-600" },
    { icon: FileCheck, title: "Таможенное оформление", desc: "Полное таможенное оформление: расчёт пошлин, подготовка документов, получение сертификата соответствия.", color: "bg-red-500/10 text-red-600" },
    { icon: Truck, title: "Доставка до двери", desc: "Доставим автомобиль до вашего города в Узбекистане. Работаем с Ташкентом и регионами.", color: "bg-cyan-500/10 text-cyan-600" },
    { icon: Wrench, title: "Техобслуживание", desc: "Помощь с первичным ТО, настройка бортового ПО, перевод интерфейса на русский/узбекский язык.", color: "bg-orange-500/10 text-orange-600" },
    { icon: Shield, title: "Гарантия и поддержка", desc: "Гарантия 1 год / 20 000 км. Консультации после покупки. Помощь с запчастями и сервисом.", color: "bg-indigo-500/10 text-indigo-600" },
    { icon: Calculator, title: "Расчёт стоимости", desc: "Бесплатный расчёт полной стоимости импорта: цена авто, пошлины, доставка, наша комиссия.", color: "bg-teal-500/10 text-teal-600" },
    { icon: Headphones, title: "Персональный менеджер", desc: "Выделенный менеджер на всех этапах сделки. Связь через Telegram, WhatsApp, телефон.", color: "bg-rose-500/10 text-rose-600" },
  ],
  en: [
    { icon: Search, title: "Car Selection", desc: "We'll find a car matching your criteria: brand, budget, trim, color. Access to thousands of vehicles from Chinese auctions and dealers.", color: "bg-blue-500/10 text-blue-600" },
    { icon: ClipboardCheck, title: "Inspection & Diagnostics", desc: "Complete vehicle history check, VIN verification, technical diagnostics. Photo and video report before purchase.", color: "bg-green-500/10 text-green-600" },
    { icon: ShoppingCart, title: "Vehicle Purchase", desc: "We purchase the vehicle at auction or from dealer at the best price. Transaction security guaranteed.", color: "bg-amber-500/10 text-amber-600" },
    { icon: Ship, title: "International Shipping", desc: "Delivery by sea, rail, or car carrier. Cargo insurance throughout the entire transit.", color: "bg-purple-500/10 text-purple-600" },
    { icon: FileCheck, title: "Customs Clearance", desc: "Full customs processing: duty calculation, document preparation, conformity certification.", color: "bg-red-500/10 text-red-600" },
    { icon: Truck, title: "Door-to-Door Delivery", desc: "We deliver the car to your city in Uzbekistan. We serve Tashkent and all regions.", color: "bg-cyan-500/10 text-cyan-600" },
    { icon: Wrench, title: "Service & Setup", desc: "Help with initial service, software setup, interface translation to Russian/Uzbek.", color: "bg-orange-500/10 text-orange-600" },
    { icon: Shield, title: "Warranty & Support", desc: "1-year / 20,000 km warranty. Post-purchase consultations. Parts and service assistance.", color: "bg-indigo-500/10 text-indigo-600" },
    { icon: Calculator, title: "Cost Calculation", desc: "Free full import cost calculation: car price, duties, delivery, our commission.", color: "bg-teal-500/10 text-teal-600" },
    { icon: Headphones, title: "Personal Manager", desc: "Dedicated manager at all stages. Contact via Telegram, WhatsApp, phone.", color: "bg-rose-500/10 text-rose-600" },
  ],
  uz: [
    { icon: Search, title: "Avtomobil tanlash", desc: "Mezonlaringiz bo'yicha avtomobil tanlaymiz: brend, byudjet, jihozlanish, rang. Xitoy auktsionlari va dilerlaridan minglab avtomobillarga kirish.", color: "bg-blue-500/10 text-blue-600" },
    { icon: ClipboardCheck, title: "Tekshiruv va diagnostika", desc: "Avtomobil tarixini to'liq tekshirish, VIN-kod tekshiruvi, texnik diagnostika. Sotib olishdan oldin foto va video hisobot.", color: "bg-green-500/10 text-green-600" },
    { icon: ShoppingCart, title: "Avtomobil sotib olish", desc: "Avtomobilni auktsion yoki dilerdan eng yaxshi narxda sotib olamiz. Bitim xavfsizligi kafolatlangan.", color: "bg-amber-500/10 text-amber-600" },
    { icon: Ship, title: "Xalqaro yetkazib berish", desc: "Dengiz, temir yo'l yoki avtovoz orqali yetkazib berish. Butun tranzit davomida yuk sug'urtasi.", color: "bg-purple-500/10 text-purple-600" },
    { icon: FileCheck, title: "Bojxona rasmiylashtiruvi", desc: "To'liq bojxona rasmiylashtiruvi: boj hisoblash, hujjatlar tayyorlash, muvofiqlik sertifikati.", color: "bg-red-500/10 text-red-600" },
    { icon: Truck, title: "Eshikkacha yetkazib berish", desc: "Avtomobilni O'zbekistondagi shahringizga yetkazib beramiz. Toshkent va barcha viloyatlarga xizmat ko'rsatamiz.", color: "bg-cyan-500/10 text-cyan-600" },
    { icon: Wrench, title: "Xizmat va sozlash", desc: "Dastlabki texnik xizmat, dasturiy ta'minot sozlash, interfeysni rus/o'zbek tiliga tarjima qilishda yordam.", color: "bg-orange-500/10 text-orange-600" },
    { icon: Shield, title: "Kafolat va qo'llab-quvvatlash", desc: "1 yil / 20 000 km kafolat. Sotib olgandan keyingi maslahatlar. Ehtiyot qismlar va xizmat ko'rsatish yordami.", color: "bg-indigo-500/10 text-indigo-600" },
    { icon: Calculator, title: "Narx hisoblash", desc: "Import narxini to'liq bepul hisoblash: avtomobil narxi, bojlar, yetkazib berish, bizning komissiya.", color: "bg-teal-500/10 text-teal-600" },
    { icon: Headphones, title: "Shaxsiy menejer", desc: "Barcha bosqichlarda maxsus menejer. Telegram, WhatsApp, telefon orqali aloqa.", color: "bg-rose-500/10 text-rose-600" },
  ],
};

export default function ServicesPage() {
  const { locale } = useLocale();
  const { ref, isVisible } = useScrollReveal();
  const items = services[locale as keyof typeof services] || services.ru;

  const title = locale === "ru" ? "Наши услуги" : locale === "uz" ? "Bizning xizmatlarimiz" : "Our Services";
  const subtitle = locale === "ru"
    ? "Полный спектр услуг по импорту автомобилей из Китая"
    : locale === "uz" ? "Xitoydan avtomobil importi bo'yicha xizmatlarning to'liq spektri"
    : "Full range of car import services from China";

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
                className={`bg-white rounded-2xl border border-border p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 ${
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
        <div className="bg-gradient-to-r from-lime to-lime-dark rounded-3xl p-10 md:p-14 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-navy mb-4">
            {locale === "ru" ? "Готовы начать?" : locale === "uz" ? "Boshlashga tayyormisiz?" : "Ready to Start?"}
          </h2>
          <p className="text-navy/70 mb-8 max-w-lg mx-auto">
            {locale === "ru"
              ? "Оставьте заявку и получите бесплатную консультацию по импорту автомобиля из Китая"
              : "Submit a request and get a free consultation on importing a car from China"}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="xl" variant="secondary" asChild>
              <Link href="/contacts">
                {locale === "ru" ? "Оставить заявку" : "Get Started"}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button size="xl" variant="outline" className="border-navy/30 text-navy hover:bg-navy hover:text-white" asChild>
              <Link href="/calculator">
                <Calculator className="w-5 h-5" />
                {locale === "ru" ? "Рассчитать стоимость" : "Calculate Cost"}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
