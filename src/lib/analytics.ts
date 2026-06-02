/**
 * Conversion-funnel analytics — thin wrapper over Plausible custom events.
 *
 * Plausible only records pageviews out of the box; to see *where* the funnel
 * leaks (reservation opened → submitted → deposit clicked, lead submitted) we
 * fire named custom events at each step. `track()` is fail-open: it no-ops on
 * the server, and if Plausible is absent/blocked (the queue stub in layout.tsx
 * still defines window.plausible, so calls are simply dropped) it never throws.
 *
 * Keep event names stable + low-cardinality (Plausible "goals"); put detail in
 * props, not the name.
 */
export type AnalyticsProps = Record<string, string | number | boolean>;

type PlausibleFn = (event: string, options?: { props?: AnalyticsProps }) => void;

export function track(event: string, props?: AnalyticsProps): void {
  if (typeof window === "undefined") return;
  try {
    const plausible = (window as unknown as { plausible?: PlausibleFn }).plausible;
    plausible?.(event, props ? { props } : undefined);
  } catch {
    // analytics must never break the UI
  }
}

/** Stable funnel event names — one source of truth for the dealer's goals. */
export const FUNNEL = {
  reserveOpen: "reserve_open",
  reserveSubmit: "reserve_submit",
  depositClick: "deposit_click",
  inquirySubmit: "inquiry_submit",
  testDriveSubmit: "test_drive_submit",
  assistantAsk: "assistant_ask",
} as const;
