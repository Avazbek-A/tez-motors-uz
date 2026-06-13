"use client";

import Link from "next/link";
import Image from "next/image";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { FloatingShapes } from "@/components/effects";

// Bump (and copy the files into the matching public/images/brands/vN folder)
// when logos change — a new PATH is a clean cache-miss at every layer. A query
// string won't work: next/image rejects ?query on local image src.
const LOGO_VERSION = "6";

const brands = [
  { name: "BYD" },
  { name: "Chery" },
  { name: "Haval" },
  { name: "Geely" },
  { name: "Changan" },
  { name: "JETOUR" },
  { name: "Tank" },
  { name: "Zeekr" },
  { name: "Li Auto" },
  { name: "Exeed" },
  { name: "Omoda" },
  { name: "XPeng" },
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
    <section className="py-16 md:py-24 bg-background relative overflow-hidden">
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
              className={`group relative p-6 text-center transition-all duration-300 hover:-translate-y-1 border border-border bg-card hover:border-white/20 ${
                isVisible ? "animate-fade-in-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-3 rounded-xl bg-white flex items-center justify-center p-2.5 group-hover:scale-110 transition-all duration-300">
                <Image
                  src={`/images/brands/v${LOGO_VERSION}/${brand.name.toLowerCase().replace(/\s+/g, "-")}.png`}
                  alt={`${brand.name} logo`}
                  width={64}
                  height={64}
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-sm font-semibold text-white/70 group-hover:text-foreground transition-colors duration-300">
                {brand.name}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
