"use client";

import { useEffect, useState } from "react";

/**
 * Returns `true` when expensive visual effects should be disabled.
 *
 * Triggers:
 * - viewport width < 768px (mobile / small tablets) — particles + tilt
 *   + canvas animations choke phones, and the marketing flair has zero
 *   added value at that size anyway
 * - `prefers-reduced-motion: reduce` — accessibility + battery
 *
 * SSR-safe: returns `false` on the server, then re-evaluates after
 * mount. Effects components should treat this as "render the cheap
 * fallback" rather than "render nothing", so the layout doesn't shift.
 */
export function useReducedEffects(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sizeQuery = window.matchMedia("(max-width: 767px)");

    const evaluate = () => {
      setReduced(motionQuery.matches || sizeQuery.matches);
    };

    evaluate();
    motionQuery.addEventListener("change", evaluate);
    sizeQuery.addEventListener("change", evaluate);
    return () => {
      motionQuery.removeEventListener("change", evaluate);
      sizeQuery.removeEventListener("change", evaluate);
    };
  }, []);

  return reduced;
}
