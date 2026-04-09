"use client";

import { cn } from "@/lib/utils";

interface ScanlineOverlayProps {
  className?: string;
  intensity?: "light" | "medium" | "heavy";
}

export function ScanlineOverlay({ className = "", intensity = "light" }: ScanlineOverlayProps) {
  const opacityMap = {
    light: "opacity-20",
    medium: "opacity-40",
    heavy: "opacity-60",
  };

  return (
    <div
      className={cn(
        "absolute inset-0 pointer-events-none z-10",
        opacityMap[intensity],
        className
      )}
    >
      {/* Static scanlines */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 212, 255, 0.03) 2px,
            rgba(0, 212, 255, 0.03) 4px
          )`,
        }}
      />
      {/* Moving scanline bar */}
      <div
        className="absolute left-0 right-0 h-[2px] animate-[scanline-move_4s_linear_infinite]"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.3), transparent)",
        }}
      />
    </div>
  );
}
