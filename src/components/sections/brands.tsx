"use client";

import Link from "next/link";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { FloatingShapes } from "@/components/effects";

const brands = [
  { name: "BYD", color: "from-neon-blue to-neon-purple" },
  { name: "Chery", color: "from-neon-pink to-neon-purple" },
  { name: "Haval", color: "from-neon-green to-neon-blue" },
  { name: "Geely", color: "from-neon-purple to-neon-blue" },
  { name: "Changan", color: "from-neon-cyan to-neon-blue" },
  { name: "JETOUR", color: "from-neon-blue to-neon-green" },
  { name: "Tank", color: "from-neon-pink to-neon-purple" },
  { name: "Zeekr", color: "from-neon-purple to-neon-pink" },
  { name: "Li Auto", color: "from-neon-cyan to-neon-purple" },
  { name: "Exeed", color: "from-neon-pink to-neon-blue" },
  { name: "Omoda", color: "from-neon-green to-neon-cyan" },
  { name: "XPeng", color: "from-neon-blue to-neon-pink" },
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
    <section className="py-16 md:py-24 bg-[#0a0a0f] relative overflow-hidden">
      {/* Floating shapes background */}
      <FloatingShapes count={6} />

      <div className="container-custom relative z-10">
        <SectionHeading title={title} subtitle={subtitle} />

        <div
          ref={ref}
          className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4"
        >
          {brands.map((brand, index) => (
            <Link
              key={brand.name}
              href={localizedPath(locale, `/catalog?brand=${encodeURIComponent(brand.name)}`)}
              className={`group relative rounded-2xl p-6 text-center transition-all duration-300 hover:-translate-y-1 border border-white/[0.06] bg-[#0d0d15]/80 backdrop-blur-sm hover:border-neon-blue/25 hover:shadow-[0_0_20px_rgba(0,212,255,0.08)] ${
                isVisible ? "animate-fade-in-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${brand.color} flex items-center justify-center mx-auto mb-3 group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(0,212,255,0.3)] transition-all duration-300`}>
                <span className="text-white font-bold text-xs">
                  {brand.name.charAt(0)}
                </span>
              </div>
              <p className="text-sm font-semibold text-white/70 group-hover:text-neon-blue transition-colors duration-300">
                {brand.name}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
