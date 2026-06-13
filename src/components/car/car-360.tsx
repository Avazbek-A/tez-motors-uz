"use client";

import { useState } from "react";

/**
 * AutoHome 360° walkthrough. The pano is hosted on pano.autohome.com.cn (China),
 * so the iframe is loaded in the VISITOR's browser — slow/flaky from Uzbekistan.
 * To avoid hanging page load (and the "took too long to respond" error), we DON'T
 * embed it until the visitor clicks: a poster + button, then the iframe mounts.
 * A direct "open in new tab" link is always offered as a graceful fallback.
 */
export function Car360({
  panoId,
  poster,
  locale,
}: {
  panoId: string;
  poster?: string;
  locale: string;
}) {
  const [open, setOpen] = useState(false);
  const src = `https://pano.autohome.com.cn/car/pano/${panoId}?_ahrotate=1`;
  const t = (ru: string, uz: string, en: string) => (locale === "ru" ? ru : locale === "uz" ? uz : en);

  if (open) {
    return (
      <div className="relative w-full h-full">
        <iframe
          title="360"
          src={src}
          className="w-full h-full"
          allow="accelerometer; gyroscope; fullscreen"
          allowFullScreen
        />
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-2 right-2 z-10 bg-black/70 text-white/90 text-xs rounded px-2 py-1 border border-white/20 hover:bg-black/90"
        >
          {t("Открыть в новой вкладке ↗", "Yangi oynada ochish ↗", "Open in new tab ↗")}
        </a>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="group relative w-full h-full flex flex-col items-center justify-center gap-3 bg-black text-white cursor-pointer"
      style={
        poster
          ? { backgroundImage: `url(${poster})`, backgroundSize: "cover", backgroundPosition: "center" }
          : undefined
      }
      aria-label={t("Открыть 360° обзор", "360° ko‘rinishni ochish", "Open 360° walkthrough")}
    >
      <span className="absolute inset-0 bg-black/55 group-hover:bg-black/45 transition-colors" />
      <span className="relative flex items-center justify-center w-16 h-16 rounded-full border-2 border-white/80 text-lg font-bold backdrop-blur-sm">
        360°
      </span>
      <span className="relative text-sm font-medium">
        {t("Нажмите для 360° обзора", "360° ko‘rinish uchun bosing", "Tap for 360° walkthrough")}
      </span>
      <span className="relative text-xs text-white/60 max-w-[80%] text-center">
        {t(
          "Загружается с AutoHome — может занять несколько секунд",
          "AutoHome’dan yuklanadi — bir necha soniya olishi mumkin",
          "Loads from AutoHome — may take a few seconds",
        )}
      </span>
    </button>
  );
}
