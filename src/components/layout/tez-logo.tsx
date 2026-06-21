import Link from "next/link";
import { cn } from "@/lib/utils";

/** The stepped-bars mark on its own (no wordmark) — for compact spots: loading
 *  states, inline glyphs. Tight viewBox cropped to the bars so the mark FILLS
 *  the box you give it (no dead padding). `tone`:
 *   - "platinum" (default) brushed-metal gradient — for dark surfaces
 *   - "ink" solid #14151a — for light/platinum surfaces
 *   - "mono" currentColor — inherits the surrounding text color (theme-adaptive)
 *  For a finished brand badge on any surface, prefer <TezTile>. */
export function TezMark({
  className,
  width = 30,
  height = 20,
  tone = "platinum",
}: {
  className?: string;
  width?: number;
  height?: number;
  tone?: "platinum" | "ink" | "mono";
}) {
  const fill = tone === "ink" ? "#14151a" : tone === "mono" ? "currentColor" : "url(#tez-mark)";
  return (
    <svg width={width} height={height} viewBox="20 34 80 52" fill="none" aria-hidden="true" className={className}>
      {tone === "platinum" && (
        <defs>
          <linearGradient id="tez-mark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#eff3f7" />
            <stop offset="0.42" stopColor="#bfc9d6" />
            <stop offset="0.72" stopColor="#8995a6" />
            <stop offset="1" stopColor="#dae0e7" />
          </linearGradient>
        </defs>
      )}
      <path d="M27 34 H100 L93 46 H20 Z" fill={fill} />
      <path d="M27 54 H78 L71 66 H20 Z" fill={fill} />
      <path d="M27 74 H100 L93 86 H20 Z" fill={fill} />
    </svg>
  );
}

/**
 * Finished brand badge — the app-icon: a brushed-platinum rounded tile with the
 * ink stepped-bars filling it. High contrast on ANY surface (its own tile), so
 * it's the right brand glyph for admin chrome, login, avatars, empty states.
 * Size in px; the bars + radius scale with it.
 */
export function TezTile({ size = 64, className }: { size?: number; className?: string }) {
  const barW = Math.round(size * 0.6);
  const barH = Math.round(barW * (52 / 80));
  return (
    <span
      className={cn("inline-flex items-center justify-center shrink-0", className)}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        background: "linear-gradient(135deg,#f4f7fa 0%,#cdd6e1 46%,#a9b4c3 73%,#e1e6ec 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.6), 0 1px 2px rgba(20,21,26,.18), 0 6px 18px -8px rgba(20,21,26,.35)",
      }}
      role="img"
      aria-label="Tez Motors"
    >
      <svg width={barW} height={barH} viewBox="20 34 80 52" fill="none" aria-hidden="true">
        <path d="M27 34 H100 L93 46 H20 Z" fill="#14151a" />
        <path d="M27 54 H78 L71 66 H20 Z" fill="#14151a" />
        <path d="M27 74 H100 L93 86 H20 Z" fill="#14151a" />
      </svg>
    </span>
  );
}

/**
 * Tez Motors logo — the stepped-bars mark + TEZ MOTORS wordmark on one line.
 *
 * The mark is the three sheared bars (the ≡ from the heritage mark, rebuilt
 * sharp) — it reads as equal (transparent pricing), speed (*tez* = fast) and a
 * road to the horizon.
 *
 * - Inline SVG so the mark stays razor-sharp at any size and needs no image request.
 * - The wordmark inherits the current text color (defaults to --foreground via the
 *   wrapper) so it works on the adaptive header AND the always-dark footer
 *   (pass `className="text-white"` there). The mark keeps its platinum gradient.
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
      {/* Square viewBox (matches the app icon); the bars sit centred with the
          official clear space. Height is set per placement via `size`. */}
      <svg
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
        className={cn("w-auto shrink-0", s.mark)}
      >
        <defs>
          <linearGradient id="tez-bars" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#eff3f7" />
            <stop offset="0.42" stopColor="#bfc9d6" />
            <stop offset="0.72" stopColor="#8995a6" />
            <stop offset="1" stopColor="#dae0e7" />
          </linearGradient>
        </defs>
        <path d="M27 34 H100 L93 46 H20 Z" fill="url(#tez-bars)" />
        <path d="M27 54 H78 L71 66 H20 Z" fill="url(#tez-bars)" />
        <path d="M27 74 H100 L93 86 H20 Z" fill="url(#tez-bars)" />
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
