import Link from "next/link";
import { cn } from "@/lib/utils";

/** The chevron mark on its own (no wordmark) — for compact spots: admin chrome,
 *  loading states, avatars. Size via width/height or a wrapping `scale-*`. */
export function TezMark({ className, width = 28, height = 32 }: { className?: string; width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 8 90 88" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="tez-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eff3f7" />
          <stop offset="0.42" stopColor="#bfc9d6" />
          <stop offset="0.72" stopColor="#8995a6" />
          <stop offset="1" stopColor="#dae0e7" />
        </linearGradient>
      </defs>
      <path d="M12 18 L48 52 L12 86" stroke="url(#tez-mark)" strokeWidth="14" />
      <path d="M46 18 L82 52 L46 86" stroke="url(#tez-mark)" strokeWidth="14" opacity="0.5" />
    </svg>
  );
}

/**
 * Tez Motors logo — the approved "Vanguard" inline lockup.
 * Double chevron (brushed-platinum gradient) + TEZ MOTORS wordmark on one line.
 *
 * - Inline SVG so the mark stays razor-sharp at any size and needs no image request.
 * - The wordmark inherits the current text color (defaults to --foreground via the
 *   wrapper) so it works on the adaptive header AND the always-dark footer
 *   (pass `className="text-white"` there). The chevron keeps its platinum gradient.
 *
 * Usage:
 *   <TezLogo href={localizedPath(locale, "/")} />                 // header
 *   <TezLogo ... className="text-white" />                        // dark footer
 *   <TezLogo ... wordmarkClassName="hidden sm:inline" />          // hide wordmark on phones
 */
// Per-placement sizing. Header is the hero lockup (scales up on desktop); footer
// is a deliberately modest mark so it doesn't dominate the column.
const LOGO_SIZES = {
  // Mobile is smaller so the wordmark fits alongside the lang switcher + controls.
  header: { mark: "h-7 sm:h-10 lg:h-12", word: "text-sm sm:text-xl lg:text-2xl" },
  footer: { mark: "h-9", word: "text-lg" },
} as const;

export function TezLogo({
  className,
  wordmarkClassName,
  href = "/",
  size = "header",
}: {
  className?: string;
  wordmarkClassName?: string;
  href?: string;
  size?: keyof typeof LOGO_SIZES;
}) {
  const s = LOGO_SIZES[size];
  return (
    <Link
      href={href}
      aria-label="Tez Motors"
      className={cn("inline-flex items-center gap-2.5 text-foreground shrink-0 group", className)}
    >
      {/* viewBox is cropped tight to the strokes (no dead padding); height is set
          per placement via `size` so the mark fills its space without dominating. */}
      <svg
        viewBox="0 8 90 88"
        fill="none"
        aria-hidden="true"
        className={cn("w-auto shrink-0", s.mark)}
      >
        <defs>
          <linearGradient id="tez-chevron" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#eff3f7" />
            <stop offset="0.42" stopColor="#bfc9d6" />
            <stop offset="0.72" stopColor="#8995a6" />
            <stop offset="1" stopColor="#dae0e7" />
          </linearGradient>
        </defs>
        <path d="M12 18 L48 52 L12 86" stroke="url(#tez-chevron)" strokeWidth="14" />
        <path d="M46 18 L82 52 L46 86" stroke="url(#tez-chevron)" strokeWidth="14" opacity="0.5" />
      </svg>
      <span
        className={cn(
          "whitespace-nowrap font-bold tracking-[0.14em] uppercase transition-colors leading-none",
          s.word,
          wordmarkClassName
        )}
      >
        TEZ MOTORS
      </span>
    </Link>
  );
}
