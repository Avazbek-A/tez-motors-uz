"use client";

import Link from "next/link";
import { ArrowRight, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import { useLocale } from "@/i18n/locale-context";

const stats = [
  { value: 500, suffix: "+", key: "cars" },
  { value: 400, suffix: "+", key: "clients" },
  { value: 3, suffix: "+", key: "experience" },
  { value: 10, suffix: "+", key: "cities" },
];

export function Hero() {
  const { dictionary } = useLocale();

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-navy-dark via-navy to-navy-light" />
      <div className="absolute inset-0 bg-[url('/images/hero-pattern.svg')] opacity-5" />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-lime/5 to-transparent" />

      {/* Animated circles */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-lime/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-lime/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

      <div className="container-custom relative z-10 pt-24 pb-16">
        <div className="max-w-4xl">
          <div className="animate-fade-in-up" style={{ animationDelay: "0ms" }}>
            <span className="inline-flex items-center gap-2 bg-lime/15 text-lime rounded-full px-4 py-2 text-sm font-medium mb-6">
              <span className="w-2 h-2 bg-lime rounded-full animate-pulse" />
              Tez Motors — Import & Delivery
            </span>
          </div>

          <h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight animate-fade-in-up"
            style={{ animationDelay: "100ms" }}
          >
            {dictionary.hero.title}{" "}
            <span className="text-gradient">{dictionary.hero.titleAccent}</span>
          </h1>

          <p
            className="mt-6 text-lg md:text-xl text-white/60 max-w-2xl leading-relaxed animate-fade-in-up"
            style={{ animationDelay: "200ms" }}
          >
            {dictionary.hero.subtitle}
          </p>

          <div
            className="mt-10 flex flex-col sm:flex-row gap-4 animate-fade-in-up"
            style={{ animationDelay: "300ms" }}
          >
            <Button size="xl" className="group" asChild>
              <Link href="/catalog">
                {dictionary.hero.cta}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button size="xl" variant="outlineLight" asChild>
              <Link href="/calculator">
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
          {stats.map((stat) => (
            <div key={stat.key} className="glass rounded-2xl p-6 text-center">
              <div className="text-3xl md:text-4xl font-bold text-lime">
                <AnimatedCounter end={stat.value} suffix={stat.suffix} duration={2000} />
              </div>
              <div className="mt-1 text-sm text-white/50">
                {dictionary.hero.stats[stat.key as keyof typeof dictionary.hero.stats]}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
