"use client";

import { useEffect } from "react";
import { ATTRIBUTION_COOKIE, attributionFromParams } from "@/lib/attribution";

/**
 * Captures UTM params + referrer on the first visit and stores them in a
 * 30-day cookie. The inquiry API reads this cookie so leads are attributed to
 * the marketing channel/campaign that drove them. First-touch wins (won't
 * overwrite an existing cookie). Renders nothing.
 */
export function AttributionCapture() {
  useEffect(() => {
    try {
      if (document.cookie.includes(`${ATTRIBUTION_COOKIE}=`)) return; // first-touch
      const attr = attributionFromParams(window.location.search, document.referrer);
      // Only persist when there's a UTM or an external referrer (skip same-site).
      if (!attr) return;
      if (attr.referrer && !attr.source && !attr.medium && !attr.campaign) {
        try {
          if (new URL(attr.referrer).hostname === window.location.hostname) return;
        } catch {
          /* keep */
        }
      }
      const value = encodeURIComponent(JSON.stringify(attr));
      // Secure attribute (HTTPS-only) is set on https: pages — keep it off when
      // the dev server runs over http://localhost so the cookie is still saved
      // there. In production the site is HTTPS, so the flag turns on.
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${ATTRIBUTION_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`;
    } catch {
      /* no-op */
    }
  }, []);
  return null;
}
