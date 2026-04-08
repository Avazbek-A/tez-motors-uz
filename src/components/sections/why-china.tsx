"use client";

import { TrendingUp, Cpu, Battery, BadgeDollarSign, Shield, Award } from "lucide-react";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

const reasons = {
  ru: [
    { icon: BadgeDollarSign, title: "Выгодная цена", desc: "Цены на 20-40% ниже, чем в местных автосалонах. Прямые закупки без посредников." },
    { icon: Cpu, title: "Передовые технологии", desc: "Китайские автомобили оснащены самыми современными системами: большие экраны, ADAS, умные функции." },
    { icon: Battery, title: "Лидер в EV", desc: "Китай — мировой лидер по производству электромобилей и гибридов. Широкий выбор EV и PHEV." },
    { icon: TrendingUp, title: "Быстрый рост качества", desc: "Качество китайских авто выросло в разы за последние годы. Рейтинги Euro NCAP на уровне 5 звёзд." },
    { icon: Shield, title: "Надёжные гарантии", desc: "Заводская гарантия до 8 лет на батарею EV. Качество запчастей и сервиса на высоком уровне." },
    { icon: Award, title: "Богатая комплектация", desc: "Даже базовые модели идут с панорамной крышей, кожей, подогревом — то, что у конкурентов стоит дороже." },
  ],
  uz: [
    { icon: BadgeDollarSign, title: "Qulay narx", desc: "Narxlar mahalliy avtosalonlarga nisbatan 20-40% arzon. Vositachilarsiz to'g'ridan-to'g'ri xaridlar." },
    { icon: Cpu, title: "Ilg'or texnologiyalar", desc: "Xitoy avtomobillari eng zamonaviy tizimlar bilan jihozlangan: katta ekranlar, ADAS, aqlli funksiyalar." },
    { icon: Battery, title: "EV yetakchisi", desc: "Xitoy — elektromobillar va gibridlar ishlab chiqarish bo'yicha jahon yetakchisi." },
    { icon: TrendingUp, title: "Sifatning tez o'sishi", desc: "Xitoy avtomobillarining sifati so'nggi yillarda bir necha barobar oshdi." },
    { icon: Shield, title: "Ishonchli kafolatlar", desc: "EV batareyasiga 8 yilgacha zavod kafolati. Ehtiyot qismlar va xizmat ko'rsatish yuqori darajada." },
    { icon: Award, title: "Boy jihozlanish", desc: "Hatto asosiy modellar ham panoramali tom, teri, isitish bilan ta'minlangan." },
  ],
  en: [
    { icon: BadgeDollarSign, title: "Great Value", desc: "Prices 20-40% lower than local dealerships. Direct purchases without middlemen." },
    { icon: Cpu, title: "Advanced Technology", desc: "Chinese cars feature cutting-edge systems: large screens, ADAS, smart features." },
    { icon: Battery, title: "EV Leadership", desc: "China is the world leader in EV and hybrid production. Wide selection of EVs and PHEVs." },
    { icon: TrendingUp, title: "Rapid Quality Growth", desc: "Chinese car quality has improved dramatically. Euro NCAP ratings reaching 5 stars." },
    { icon: Shield, title: "Reliable Warranties", desc: "Factory warranty up to 8 years on EV battery. High-quality parts and service." },
    { icon: Award, title: "Rich Equipment", desc: "Even base models come with panoramic roof, leather, heated seats — features that cost extra elsewhere." },
  ],
};

export function WhyChina() {
  const { locale } = useLocale();
  const { ref, isVisible } = useScrollReveal();
  const items = reasons[locale as keyof typeof reasons] || reasons.ru;

  const title = locale === "ru" ? "Почему авто из Китая?" : locale === "uz" ? "Nima uchun Xitoydan avto?" : "Why Cars from China?";
  const subtitle = locale === "ru"
    ? "Китайский автопром стал одним из лидеров мирового рынка"
    : locale === "uz"
    ? "Xitoy avtoprom jahon bozorining yetakchilaridan biriga aylandi"
    : "Chinese automotive industry has become a world market leader";

  return (
    <section className="py-20 md:py-28 bg-muted/50">
      <div className="container-custom">
        <SectionHeading title={title} subtitle={subtitle} />

        <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className={`bg-white rounded-2xl p-6 border border-border hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 ${
                  isVisible ? "animate-fade-in-up" : "opacity-0"
                }`}
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-lime/15 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-lime-dark" />
                </div>
                <h3 className="text-base font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
