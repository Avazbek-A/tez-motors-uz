"use client";

import Link from "next/link";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

const brands = [
  { name: "BYD", color: "from-blue-600 to-blue-800" },
  { name: "Chery", color: "from-red-600 to-red-800" },
  { name: "Haval", color: "from-emerald-600 to-emerald-800" },
  { name: "Geely", color: "from-indigo-600 to-indigo-800" },
  { name: "Changan", color: "from-slate-600 to-slate-800" },
  { name: "JETOUR", color: "from-cyan-600 to-cyan-800" },
  { name: "Tank", color: "from-amber-600 to-amber-800" },
  { name: "Zeekr", color: "from-violet-600 to-violet-800" },
  { name: "Li Auto", color: "from-zinc-600 to-zinc-800" },
  { name: "Exeed", color: "from-rose-600 to-rose-800" },
  { name: "Omoda", color: "from-orange-600 to-orange-800" },
  { name: "XPeng", color: "from-teal-600 to-teal-800" },
];

export function Brands() {
  const { locale } = useLocale();
  const { ref, isVisible } = useScrollReveal();

  const title = locale === "ru" ? "Бренды, с которыми мы работаем" : locale === "uz" ? "Biz ishlaydigan brendlar" : "Brands We Work With";
  const subtitle = locale === "ru"
    ? "Импортируем автомобили ведущих китайских производителей"
    : locale === "uz"
    ? "Yetakchi xitoy ishlab chiqaruvchilaridan avtomobillar import qilamiz"
    : "We import vehicles from leading Chinese manufacturers";

  return (
    <section className="py-16 md:py-24">
      <div className="container-custom">
        <SectionHeading title={title} subtitle={subtitle} />

        <div
          ref={ref}
          className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4"
        >
          {brands.map((brand, index) => (
            <Link
              key={brand.name}
              href={`/catalog?brand=${encodeURIComponent(brand.name)}`}
              className={`group relative rounded-2xl p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg border border-border bg-white ${
                isVisible ? "animate-fade-in-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${brand.color} flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
                <span className="text-white font-bold text-xs">
                  {brand.name.charAt(0)}
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground group-hover:text-lime-dark transition-colors">
                {brand.name}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
