"use client";

import { cn } from "@/lib/utils";

interface GlitchTextProps {
  text: string;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "span" | "p";
  className?: string;
  glitchOnHover?: boolean;
}

/**
 * Retired glitch effect. The Cinematic Showroom language is calm and premium —
 * no RGB-split / CRT glitch. Renders the text cleanly; the component is kept so
 * existing callers don't break.
 */
export function GlitchText({
  text,
  as: Tag = "h2",
  className = "",
}: GlitchTextProps) {
  return (
    <Tag className={cn("relative inline-block", className)} data-text={text}>
      <span className="relative z-10">{text}</span>
    </Tag>
  );
}
