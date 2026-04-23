"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";
import { getFavoriteIds } from "@/lib/favorites";

export function FavoritesPill() {
  const { locale } = useLocale();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(getFavoriteIds().length);
    sync();
    window.addEventListener("tez-motors:favorites", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("tez-motors:favorites", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (count === 0) return null;

  return (
    <Link
      href={localizedPath(locale, "/favorites")}
      className="fixed bottom-6 left-6 z-40 inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-[#0d0d15]/95 px-4 py-3 text-sm font-medium text-rose-200 shadow-[0_0_18px_rgba(244,63,94,0.2)] backdrop-blur-sm transition-transform hover:scale-[1.02]"
    >
      <Heart className="h-4 w-4 fill-current" />
      {count} saved
    </Link>
  );
}
