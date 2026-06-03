"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import { CarCard } from "@/components/catalog/car-card";
import { FindMyCar } from "@/components/assistant/find-my-car";
import type { Car } from "@/types/car";

/**
 * Telegram Mini App home. Runs inside Telegram's WebView: loads the WebApp SDK,
 * signs the user in silently via initData (POST /api/tg/auth), applies Telegram
 * theme, then shows the AI "find my car" widget + a compact, real-inventory
 * catalog. Degrades gracefully when opened in a normal browser (no sign-in, the
 * catalog + assistant still work). Lead capture is handled by FindMyCar.
 */
interface TelegramWebApp {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  themeParams?: { bg_color?: string };
}
declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export default function MiniAppPage() {
  const { locale } = useLocale();
  const t = (ru: string, uz: string, en: string) => (locale === "uz" ? uz : locale === "en" ? en : ru);

  const [cars, setCars] = useState<Car[]>([]);
  const [loadingCars, setLoadingCars] = useState(true);
  const [welcome, setWelcome] = useState<string | null>(null);

  const signIn = useCallback(() => {
    const tg = window.Telegram?.WebApp;
    try {
      tg?.ready?.();
      tg?.expand?.();
    } catch {
      /* ignore */
    }
    const initData = tg?.initData;
    if (!initData) return;
    fetch("/api/tg/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) setWelcome(d.customer?.name || null);
      })
      .catch(() => {});
  }, []);

  // Load the Telegram WebApp SDK, then sign in.
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      signIn();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-web-app.js";
    s.async = true;
    s.onload = signIn;
    document.head.appendChild(s);
  }, [signIn]);

  // Load a compact slice of real inventory.
  useEffect(() => {
    fetch("/api/cars?limit=12")
      .then((r) => r.json())
      .then((d) => setCars(d.cars || []))
      .catch(() => {})
      .finally(() => setLoadingCars(false));
  }, []);

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Tez Motors</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        {welcome
          ? t(`Здравствуйте, ${welcome}! Подберём авто из Китая под ключ.`, `Salom, ${welcome}! Xitoydan avto tanlaymiz.`, `Hi ${welcome}! Let's find your car from China.`)
          : t("Импорт авто из Китая под ключ — подберём за минуту.", "Xitoydan avto importi — bir daqiqada tanlaymiz.", "Turn-key car import from China — find yours in a minute.")}
      </p>

      <FindMyCar />

      <h2 className="text-sm font-semibold text-foreground mt-7 mb-3">
        {t("В наличии", "Mavjud", "In stock")}
      </h2>
      {loadingCars ? (
        <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" /></div>
      ) : cars.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("Скоро здесь появятся авто.", "Tez orada avtomobillar paydo bo'ladi.", "Cars coming soon.")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {cars.map((car) => (
            <CarCard key={car.id} car={car} />
          ))}
        </div>
      )}
    </div>
  );
}
