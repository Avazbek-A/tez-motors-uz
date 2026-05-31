"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/i18n/locale-context";
import { locales, type Locale } from "@/i18n/config";
import { localizedPath } from "@/lib/locale-path";
import { cn } from "@/lib/utils";

const localeLabels: Record<Locale, string> = {
  ru: "RU",
  uz: "UZ",
  en: "EN",
};

export function LanguageSwitcher({ isScrolled }: { isScrolled: boolean }) {
  const { locale, setLocale } = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const changeLocale = async (nextLocale: Locale) => {
    await setLocale(nextLocale);
    router.replace(localizedPath(nextLocale, pathname));
  };

  return (
    <div className="flex items-center gap-0.5 rounded-lg overflow-hidden border border-white/10 bg-white/5">
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => changeLocale(l)}
          className={cn(
            "px-2 py-1 text-xs font-semibold transition-all",
            locale === l
              ? "bg-neon-blue/20 text-neon-blue"
              : "text-white/50 hover:text-white hover:bg-white/10"
          )}
        >
          {localeLabels[l]}
        </button>
      ))}
    </div>
  );
}
