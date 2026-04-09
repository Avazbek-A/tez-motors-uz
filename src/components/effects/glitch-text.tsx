"use client";

import { cn } from "@/lib/utils";

interface GlitchTextProps {
  text: string;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "span" | "p";
  className?: string;
  glitchOnHover?: boolean;
}

export function GlitchText({
  text,
  as: Tag = "h2",
  className = "",
  glitchOnHover = false,
}: GlitchTextProps) {
  return (
    <Tag
      className={cn("relative inline-block", className)}
      data-text={text}
    >
      <span className="relative z-10">{text}</span>
      <span
        className={cn(
          "absolute top-0 left-0 w-full h-full text-neon-pink opacity-0",
          glitchOnHover
            ? "group-hover:animate-[glitch_0.3s_linear_infinite] group-hover:opacity-80"
            : "animate-[glitch_3s_linear_infinite] opacity-50"
        )}
        style={{ clipPath: "inset(0)", animationDelay: "0.1s" }}
        aria-hidden="true"
      >
        {text}
      </span>
      <span
        className={cn(
          "absolute top-0 left-0 w-full h-full text-neon-blue opacity-0",
          glitchOnHover
            ? "group-hover:animate-[glitch_0.3s_linear_infinite_reverse] group-hover:opacity-80"
            : "animate-[glitch_3s_linear_infinite_reverse] opacity-50"
        )}
        style={{ clipPath: "inset(0)", animationDelay: "0.2s" }}
        aria-hidden="true"
      >
        {text}
      </span>
    </Tag>
  );
}
