"use client";

interface ScanlineOverlayProps {
  className?: string;
  intensity?: "light" | "medium" | "heavy";
}

/**
 * Retired CRT scanline overlay. It was a pure cyberpunk motif and is dropped in
 * the Cinematic Showroom system. Renders nothing; kept so callers don't break.
 */
export function ScanlineOverlay(_props: ScanlineOverlayProps) {
  return null;
}
