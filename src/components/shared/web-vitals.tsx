"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Real-user Core Web Vitals reporter (Phase AT). Beacons field LCP/CLS/INP/
 * FCP/TTFB to /api/rum so the dealer sees the experience real visitors get.
 * Uses sendBeacon (survives page unload), fail-open, fire-and-forget. Anonymous
 * — only the metric + coarse pathname, no PII.
 */
const TRACKED = new Set(["LCP", "CLS", "INP", "FCP", "TTFB"]);

export function WebVitals() {
  useReportWebVitals((metric) => {
    if (!TRACKED.has(metric.name)) return;
    try {
      const body = JSON.stringify({
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        path: window.location.pathname,
      });
      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon("/api/rum", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/rum", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
      }
    } catch {
      /* never let telemetry break the page */
    }
  });
  return null;
}
