"use client";

import { cn } from "@/lib/utils";

interface GridBackgroundProps {
  className?: string;
  perspective?: boolean;
}

export function GridBackground({ className = "", perspective = false }: GridBackgroundProps) {
  if (perspective) {
    return (
      <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 212, 255, 0.15) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 212, 255, 0.15) 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
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
      className={cn("absolute inset-0 pointer-events-none cyber-grid opacity-40", className)}
    />
  );
}
