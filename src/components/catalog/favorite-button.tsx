"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasFavorite, toggleFavorite } from "@/lib/favorites";

export function FavoriteButton({
  carId,
  className,
}: {
  carId: string;
  className?: string;
}) {
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    const sync = () => setFavorite(hasFavorite(carId));
    sync();
    window.addEventListener("tez-motors:favorites", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("tez-motors:favorites", sync);
      window.removeEventListener("storage", sync);
    };
  }, [carId]);

  return (
    <button
      type="button"
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = toggleFavorite(carId);
        setFavorite(next.includes(carId));
      }}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
        favorite
          ? "border-rose-400/60 bg-rose-500/20 text-rose-300"
          : "border-white/10 bg-black/30 text-white/60 hover:bg-white/10 hover:text-white",
        className,
      )}
    >
      <Heart className={cn("h-4 w-4", favorite && "fill-current")} />
    </button>
  );
}
