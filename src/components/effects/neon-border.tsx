"use client";

import { cn } from "@/lib/utils";

interface NeonBorderProps {
  children: React.ReactNode;
  className?: string;
  color?: "blue" | "purple" | "green" | "pink" | "rainbow";
  animated?: boolean;
  borderWidth?: number;
}

/**
 * "Cinematic Showroom" frame. The neon-glow border is retired: this renders a
 * premium hairline border with a soft ambient shadow (no glow). The `color` /
 * `animated` props are kept for API compatibility but no longer tint neon —
 * everything resolves to the platinum / hairline language.
 */
export function NeonBorder({
  children,
  className = "",
  color = "blue",
  borderWidth = 1,
}: NeonBorderProps) {
  // The "rainbow" variant becomes a single brushed-metallic edge.
  if (color === "rainbow") {
    return (
      <div className={cn("relative p-[1px]", className)}>
        <div
          className="absolute inset-0"
          style={{
            background: "var(--metallic)",
            opacity: 0.85,
            padding: borderWidth,
            WebkitMask:
              "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />
        <div className="relative bg-[var(--bg-2)]">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={cn("relative", className)}
      style={{
        border: `${borderWidth}px solid var(--line-2)`,
        boxShadow: "0 10px 34px rgba(0,0,0,0.46)",
      }}
    >
      {children}
    </div>
  );
}
