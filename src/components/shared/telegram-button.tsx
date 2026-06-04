"use client";

import { useState, useEffect } from "react";
import { useSiteSettings } from "@/lib/site-settings-context";
import { useLocale } from "@/i18n/locale-context";
import { cn, telegramLink } from "@/lib/utils";

/**
 * Floating Telegram contact button — the PRIMARY always-visible contact surface.
 * Telegram is the dominant messenger in Uzbekistan, so it owns the prime
 * floating slot (was WhatsApp). Mounts in the marketing layout. Renders nothing
 * if no Telegram handle is configured.
 */
export function TelegramButton() {
  const settings = useSiteSettings();
  const { locale } = useLocale();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const href = telegramLink(settings.telegram);
  if (!isVisible || !href) return null;

  const label =
    locale === "uz" ? "Telegram'da yozish" : locale === "en" ? "Chat on Telegram" : "Написать в Telegram";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={cn(
        "fixed bottom-6 right-6 z-40 w-14 h-14 bg-card border-2 border-neon-blue hover:bg-neon-blue/10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 animate-neon-pulse",
      )}
    >
      {/* Telegram paper-plane glyph (single path, currentColor). */}
      <svg className="w-7 h-7 text-neon-blue" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
      </svg>
    </a>
  );
}
