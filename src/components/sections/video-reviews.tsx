"use client";

import { Play, ExternalLink } from "lucide-react";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { TiltCard } from "@/components/effects";

const videos = [
  {
    id: "1",
    title: { ru: "Обзор BYD Song Plus DM-i", uz: "BYD Song Plus DM-i sharhi", en: "BYD Song Plus DM-i Review" },
    car: "BYD Song Plus DM-i 2024",
    duration: "12:45",
    thumbnail: null,
  },
  {
    id: "2",
    title: { ru: "Доставка Chery Tiggo 8 Pro", uz: "Chery Tiggo 8 Pro yetkazish", en: "Chery Tiggo 8 Pro Delivery" },
    car: "Chery Tiggo 8 Pro Max 2024",
    duration: "8:20",
    thumbnail: null,
  },
  {
    id: "3",
    title: { ru: "Tank 300 — первые впечатления", uz: "Tank 300 — birinchi taassurotlar", en: "Tank 300 — First Impressions" },
    car: "Tank 300 2024",
    duration: "15:30",
    thumbnail: null,
  },
];

export function VideoReviews() {
  const { locale } = useLocale();
  const { ref, isVisible } = useScrollReveal();

  const title = locale === "ru" ? "Видео обзоры" : locale === "uz" ? "Video sharhlar" : "Video Reviews";
  const subtitle = locale === "ru"
    ? "Смотрите обзоры доставленных автомобилей"
    : locale === "uz" ? "Yetkazilgan avtomobillar sharhlarini tomosha qiling"
    : "Watch reviews of delivered cars";

  return (
    <section className="py-20 md:py-28 bg-[#0a0a0f] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-neon-purple/5 to-transparent" />

      <div className="container-custom relative z-10">
        <SectionHeading title={title} subtitle={subtitle} light />

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {videos.map((video, index) => (
            <TiltCard
              key={video.id}
              className={`${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
              maxTilt={8}
            >
              <div
                className="group bg-[#0d0d15] border border-neon-blue/10 rounded-2xl overflow-hidden hover:border-neon-blue/30 hover:shadow-[0_0_30px_rgba(0,212,255,0.08)] transition-all duration-300 cursor-pointer"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-gradient-to-br from-neon-blue/5 to-neon-purple/5 flex items-center justify-center relative">
                  <div className="w-16 h-16 rounded-full bg-neon-blue/10 border border-neon-blue/30 flex items-center justify-center group-hover:bg-neon-blue/20 group-hover:shadow-[0_0_25px_rgba(0,212,255,0.3)] transition-all duration-300 group-hover:scale-110">
                    <Play className="w-7 h-7 text-neon-blue ml-1" />
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white/80 text-xs px-2 py-1 rounded-lg border border-white/10">
                    {video.duration}
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="text-white font-semibold text-sm mb-1 group-hover:text-neon-blue transition-colors">
                    {video.title[locale as keyof typeof video.title]}
                  </h3>
                  <p className="text-white/60 text-xs">{video.car}</p>
                </div>
              </div>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}
