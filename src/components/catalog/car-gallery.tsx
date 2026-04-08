"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X, CarFront } from "lucide-react";
import { cn } from "@/lib/utils";

interface CarGalleryProps {
  images: string[];
  brand: string;
  model: string;
}

export function CarGallery({ images, brand, model }: CarGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // If no real images, show gradient placeholders
  const hasImages = images.length > 0 && !images[0].startsWith("/images/cars/");
  const placeholderCount = Math.max(images.length, 4);

  const next = () => setActiveIndex((i) => (i + 1) % placeholderCount);
  const prev = () => setActiveIndex((i) => (i - 1 + placeholderCount) % placeholderCount);

  const gradients = [
    "from-navy/8 via-lime/5 to-muted",
    "from-lime/8 via-navy/5 to-muted",
    "from-blue-900/10 via-muted to-lime/5",
    "from-muted via-navy/5 to-blue-900/8",
  ];

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="relative group">
        <div
          className={cn(
            "aspect-[16/10] rounded-2xl overflow-hidden relative",
            `bg-gradient-to-br ${gradients[activeIndex % gradients.length]}`
          )}
        >
          {hasImages ? (
            <img
              src={images[activeIndex]}
              alt={`${brand} ${model} - ${activeIndex + 1}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <CarFront className="w-20 h-20 text-navy/10" />
              <span className="text-navy/20 text-sm font-bold mt-2 tracking-wider uppercase">
                {brand} {model}
              </span>
              <span className="text-navy/10 text-xs mt-1">Photo {activeIndex + 1}</span>
            </div>
          )}

          {/* Nav arrows */}
          {placeholderCount > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Fullscreen button */}
          <button
            onClick={() => setIsFullscreen(true)}
            className="absolute top-3 right-3 w-9 h-9 rounded-lg bg-white/80 hover:bg-white flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Image counter */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
            {activeIndex + 1} / {placeholderCount}
          </div>
        </div>
      </div>

      {/* Thumbnails */}
      {placeholderCount > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: Math.min(placeholderCount, 6) }).map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={cn(
                "shrink-0 w-20 h-14 rounded-xl overflow-hidden border-2 transition-all",
                activeIndex === i ? "border-lime" : "border-transparent opacity-60 hover:opacity-100"
              )}
            >
              <div className={cn(
                "w-full h-full flex items-center justify-center",
                `bg-gradient-to-br ${gradients[i % gradients.length]}`
              )}>
                <CarFront className="w-6 h-6 text-navy/15" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={() => setIsFullscreen(false)}>
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-full max-w-5xl aspect-[16/10] mx-4">
            <div className={cn(
              "w-full h-full rounded-2xl flex flex-col items-center justify-center",
              `bg-gradient-to-br ${gradients[activeIndex % gradients.length]}`
            )}>
              <CarFront className="w-32 h-32 text-white/15" />
              <span className="text-white/20 text-lg font-bold mt-4">{brand} {model}</span>
            </div>
          </div>
          {placeholderCount > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
