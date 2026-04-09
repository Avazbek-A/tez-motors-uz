"use client";

import { cn } from "@/lib/utils";

interface NeonBorderProps {
  children: React.ReactNode;
  className?: string;
  color?: "blue" | "purple" | "green" | "pink" | "rainbow";
  animated?: boolean;
  borderWidth?: number;
}

const colorMap = {
  blue: "rgba(0, 212, 255, 0.5)",
  purple: "rgba(139, 92, 246, 0.5)",
  green: "rgba(34, 255, 136, 0.5)",
  pink: "rgba(255, 45, 135, 0.5)",
  rainbow: "",
};

export function NeonBorder({
  children,
  className = "",
  color = "blue",
  animated = true,
  borderWidth = 1,
}: NeonBorderProps) {
  if (color === "rainbow") {
    return (
      <div className={cn("relative rounded-2xl p-[1px]", className)}>
        <div
          className={cn(
            "absolute inset-0 rounded-2xl",
            animated && "animate-border-flow"
          )}
          style={{
            background: `linear-gradient(135deg, var(--neon-blue), var(--neon-purple), var(--neon-pink), var(--neon-green), var(--neon-blue))`,
            backgroundSize: "300% 300%",
            padding: borderWidth,
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />
        <div className="relative rounded-2xl bg-[#0d0d15]">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative rounded-2xl",
        animated && "animate-glow-breathe",
        className
      )}
      style={{
        border: `${borderWidth}px solid ${colorMap[color]}`,
        boxShadow: `0 0 10px ${colorMap[color]?.replace("0.5", "0.2")}, inset 0 0 10px ${colorMap[color]?.replace("0.5", "0.05")}`,
      }}
    >
      {children}
    </div>
  );
}
