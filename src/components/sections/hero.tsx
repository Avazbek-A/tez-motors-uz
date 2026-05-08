"use client";

import Link from "next/link";
import { ArrowRight, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";
import { ParticleBackground, GlitchText, TypedText, TiltCard } from "@/components/effects";

const stats = [
  { value: 500, suffix: "+", key: "cars" },
  { value: 400, suffix: "+", key: "clients" },
  { value: 3, suffix: "+", key: "experience" },
  { value: 10, suffix: "+", key: "cities" },
];

export function Hero() {
  const { dictionary, locale } = useLocale();

  const taglines =
    locale === "ru"
      ? ["Импорт из Китая", "Доставка по СНГ", "Лучшие цены", "Гарантия качества"]
      : locale === "uz"
      ? ["Xitoydan import", "MDH bo'ylab yetkazib berish", "Eng yaxshi narxlar", "Sifat kafolati"]
      : ["Import from China", "Delivery across CIS", "Best prices", "Quality guaranteed"];

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#0a0a0f]">
      {/* Particle Background */}
      <ParticleBackground particleCount={90} color="0, 212, 255" connectionDistance={130} />

      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]" />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-neon-blue/5 to-transparent" />
      <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-gradient-to-tr from-neon-purple/5 to-transparent" />

      {/* Neon glow orbs — heavy `blur-[200px]` is desktop-only; on
          mobile the GPU cost of a 600px blurred radial isn't worth the
          decoration. The `animate-glow-breathe` orbs are also gated so
          phones don't repaint a quarter-screen blur every frame. */}
      <div className="hidden md:block absolute top-20 left-10 w-72 h-72 bg-neon-blue/10 rounded-full blur-[120px] animate-glow-breathe" />
      <div className="hidden md:block absolute bottom-20 right-10 w-96 h-96 bg-neon-purple/8 rounded-full blur-[140px] animate-glow-breathe" style={{ animationDelay: "1.5s" }} />
      <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-neon-pink/3 rounded-full blur-[200px]" />
      {/* Lighter mobile-only orb so the section still has a glow accent. */}
      <div className="md:hidden absolute top-32 right-0 w-48 h-48 bg-neon-blue/8 rounded-full blur-[60px]" />

      <div className="container-custom relative z-10 pt-24 pb-16">
        <div className="max-w-4xl">
          {/* Badge */}
          <div className="animate-fade-in-up" style={{ animationDelay: "0ms" }}>
            <span className="inline-flex items-center gap-2 bg-neon-blue/10 text-neon-blue border border-neon-blue/20 rounded-full px-4 py-2 text-sm font-mono font-medium mb-6 backdrop-blur-sm">
              <span className="w-2 h-2 bg-neon-blue rounded-full animate-neon-pulse" />
              Tez Motors -- Import & Delivery
            </span>
          </div>

          {/* Glitch Heading */}
          <div
            className="animate-fade-in-up"
            style={{ animationDelay: "100ms" }}
          >
            <GlitchText
              text={dictionary.hero.title}
              as="h1"
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight"
            />{" "}
            <span className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gradient leading-tight">
              {dictionary.hero.titleAccent}
            </span>
          </div>

          {/* Typed taglines */}
          <div
            className="mt-4 h-8 animate-fade-in-up"
            style={{ animationDelay: "150ms" }}
          >
            <TypedText
              texts={taglines}
              className="text-lg text-neon-blue/80"
              speed={70}
              deleteSpeed={35}
              pauseTime={2500}
            />
          </div>

          {/* Subtitle */}
          <p
            className="mt-4 text-lg md:text-xl text-white/60 max-w-2xl leading-relaxed animate-fade-in-up"
            style={{ animationDelay: "200ms" }}
          >
            {dictionary.hero.subtitle}
          </p>

          {/* CTA Buttons */}
          <div
            className="mt-10 flex flex-col sm:flex-row gap-4 animate-fade-in-up"
            style={{ animationDelay: "300ms" }}
          >
            <Button size="xl" className="group relative bg-neon-blue hover:bg-neon-blue/90 text-black font-bold shadow-[0_0_20px_rgba(0,212,255,0.3)] hover:shadow-[0_0_30px_rgba(0,212,255,0.5)] transition-all duration-300" asChild>
              <Link href={localizedPath(locale, "/catalog")}>
                {dictionary.hero.cta}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button size="xl" variant="outlineLight" className="border-neon-purple/40 text-neon-purple hover:bg-neon-purple/10 hover:border-neon-purple/60 hover:shadow-[0_0_20px_rgba(139,92,246,0.2)] transition-all duration-300" asChild>
              <Link href={localizedPath(locale, "/calculator")}>
                <Calculator className="w-5 h-5" />
                {dictionary.hero.ctaSecondary}
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 animate-fade-in-up"
          style={{ animationDelay: "500ms" }}
        >
          {stats.map((stat, index) => (
            <TiltCard key={stat.key} className="rounded-2xl" maxTilt={8}>
              <div className="glass rounded-2xl p-6 text-center border border-neon-blue/10 hover:border-neon-blue/25 transition-colors duration-300">
                <div className="text-3xl md:text-4xl font-bold text-neon-blue drop-shadow-[0_0_10px_rgba(0,212,255,0.3)]">
                  <AnimatedCounter end={stat.value} suffix={stat.suffix} duration={2000} />
                </div>
                <div className="mt-1 text-sm text-white/60 font-mono">
                  {dictionary.hero.stats[stat.key as keyof typeof dictionary.hero.stats]}
                </div>
              </div>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}
