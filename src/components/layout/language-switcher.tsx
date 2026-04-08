"use client";

import { useLocale } from "@/i18n/locale-context";
import { locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

const localeLabels: Record<Locale, string> = {
  ru: "RU",
  uz: "UZ",
  en: "EN",
};

export function LanguageSwitcher({ isScrolled }: { isScrolled: boolean }) {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-0.5 rounded-lg overflow-hidden border border-white/20">
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={cn(
            "px-2 py-1 text-xs font-semibold transition-all",
            locale === l
              ? "bg-lime text-navy"
              : isScrolled
                ? "text-foreground/60 hover:text-foreground hover:bg-muted"
                : "text-white/60 hover:text-white hover:bg-white/10"
          )}
        >
          {localeLabels[l]}
        </button>
      ))}
    </div>
  );
}
