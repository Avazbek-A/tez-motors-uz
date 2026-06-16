import Link from "next/link";
import { cn } from "@/lib/utils";

/** The chevron mark on its own (no wordmark) — for compact spots: admin chrome,
 *  loading states, avatars. Size via width/height or a wrapping `scale-*`. */
export function TezMark({ className, width = 28, height = 32 }: { className?: string; width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 90 104" fill="none" aria-hidden="true" className={className}>
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
export function TezLogo({
  className,
  wordmarkClassName,
  href = "/",
}: {
  className?: string;
  wordmarkClassName?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="Tez Motors"
      className={cn("inline-flex items-center gap-3 text-foreground shrink-0 group", className)}
    >
      <svg
        width="32"
        height="36"
        viewBox="0 0 90 104"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
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
          "whitespace-nowrap text-[17px] font-bold tracking-[0.12em] uppercase transition-colors",
          wordmarkClassName
        )}
      >
        TEZ MOTORS
      </span>
    </Link>
  );
}
