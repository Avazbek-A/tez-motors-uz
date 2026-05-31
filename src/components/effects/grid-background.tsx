"use client";

import { cn } from "@/lib/utils";

interface GridBackgroundProps {
  className?: string;
  perspective?: boolean;
}

/**
 * Neutral hairline grid — the cinematic blueprint motif from the hero. The
 * cyan cyber-grid is retired; lines now use the faint foreground hairline so it
 * reads as architectural texture, not neon.
 */
export function GridBackground({ className = "", perspective = false }: GridBackgroundProps) {
  const lines = "rgba(246, 245, 242, 0.06)";

  if (perspective) {
    return (
      <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(${lines} 1px, transparent 1px),
              linear-gradient(90deg, ${lines} 1px, transparent 1px)
            `,
            backgroundSize: "88px 88px",
            transform: "perspective(500px) rotateX(60deg)",
            transformOrigin: "center top",
            maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 80%)",
            WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 80%)",
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn("absolute inset-0 pointer-events-none", className)}
      style={{
        backgroundImage: `
          linear-gradient(${lines} 1px, transparent 1px),
          linear-gradient(90deg, ${lines} 1px, transparent 1px)
        `,
        backgroundSize: "88px 88px",
        maskImage: "radial-gradient(70% 70% at 50% 40%, #000 30%, transparent 80%)",
        WebkitMaskImage: "radial-gradient(70% 70% at 50% 40%, #000 30%, transparent 80%)",
      }}
    />
  );
}
