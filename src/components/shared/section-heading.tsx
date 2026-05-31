"use client";

import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  centered?: boolean;
  light?: boolean;
  className?: string;
  /**
   * Heading level. Default is `h2`. Pass `h1` on the top heading of a
   * page so each page has exactly one `<h1>` (helps SEO).
   */
  as?: "h1" | "h2" | "h3";
}

export function SectionHeading({
  title,
  subtitle,
  centered = true,
  light = false,
  className,
  as: Heading = "h2",
}: SectionHeadingProps) {
  return (
    <div className={cn("mb-12", centered && "text-center", className)}>
      <Heading
        className={cn(
          "text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground",
          light && "text-white"
        )}
      >
        {title}
      </Heading>
      {/* Recurring brushed-platinum rule — the system's signature motif. */}
      <div className={cn("mt-5 h-px w-12 bg-[var(--metallic)] opacity-80", centered && "mx-auto")} />
      {subtitle && (
        <p
          className={cn(
            "mt-4 text-lg max-w-2xl text-white/60",
            centered && "mx-auto"
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
