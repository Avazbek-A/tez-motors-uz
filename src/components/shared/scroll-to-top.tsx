"use client";

import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/locale-context";

const SCROLL_TOP = { ru: "Наверх", uz: "Yuqoriga", en: "Scroll to top" } as const;

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const { locale } = useLocale();

  useEffect(() => {
    const handleScroll = () => setIsVisible(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={SCROLL_TOP[locale]}
      className={cn(
        "fixed bottom-6 left-6 z-40 w-12 h-12 bg-neon-blue/20 hover:bg-neon-blue/30 text-neon-blue border border-neon-blue/50 rounded-full flex items-center justify-center transition-all duration-300",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
}
