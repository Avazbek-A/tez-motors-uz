"use client";

import Link from "next/link";
import { ArrowRight, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";
import { motion } from "framer-motion";

export function Hero() {
  const { dictionary, locale } = useLocale();

  return (
    <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
      {/* Cinematic Background Video */}
      <div className="absolute inset-0 w-full h-full z-0">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="object-cover w-full h-full scale-105"
        >
          {/* Using a premium driving stock video placeholder. Replace with actual brand video later. */}
          <source src="https://assets.mixkit.co/videos/preview/mixkit-driving-a-car-on-a-mountain-road-250-large.mp4" type="video/mp4" />
        </video>
        {/* Dark elegant overlay to make text pop */}
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/30" />
      </div>

      <div className="container-custom relative z-10 text-center flex flex-col items-center">
        {/* Minimalist Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/10 rounded-full px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-white">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            Premium Import & Delivery
          </span>
        </motion.div>

        {/* Striking Minimalist Typography */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl mx-auto"
        >
          <h1 className="text-5xl sm:text-6xl md:text-8xl font-light tracking-tighter text-white leading-[1.0]">
            {dictionary.hero.title} <br />
            <span className="font-display italic font-light text-[var(--accent)]">{dictionary.hero.titleAccent}</span>
          </h1>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 text-lg md:text-xl text-white/60 max-w-2xl font-light tracking-wide leading-relaxed"
        >
          {dictionary.hero.subtitle}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-12 flex flex-col sm:flex-row gap-6 w-full sm:w-auto"
        >
          <Button size="xl" className="group h-14 px-8 bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-bright)] tracking-[0.12em] uppercase text-sm rounded-none" asChild>
            <Link href={localizedPath(locale, "/catalog")}>
              {dictionary.hero.cta}
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
          <Button size="xl" variant="outline" className="group h-14 px-8 bg-transparent text-white border-white/30 hover:bg-white/10 hover:border-white font-medium tracking-wide uppercase text-sm rounded-none transition-all duration-300" asChild>
            <Link href={localizedPath(locale, "/calculator")}>
              {dictionary.hero.ctaSecondary}
            </Link>
          </Button>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-xs uppercase tracking-widest text-white/50">Scroll</span>
        <div className="w-px h-12 bg-gradient-to-b from-white/50 to-transparent animate-pulse" />
      </motion.div>
    </section>
  );
}
