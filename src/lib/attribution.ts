/**
 * Marketing attribution — pure helpers (unit-tested). Capture UTM params +
 * referrer on first visit (client), persist in a cookie, and read them back on
 * the server when an inquiry is saved so the dealer can see which channels and
 * campaigns actually convert.
 */
export const ATTRIBUTION_COOKIE = "tm_attr";

export interface Attribution {
  source?: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
}

const clean = (v: string | null | undefined, max = 120): string | undefined => {
  const t = (v || "").trim().slice(0, max);
  return t || undefined;
};

/** Build an Attribution from a query string + referrer, or null if nothing useful. */
export function attributionFromParams(search: string, referrer?: string | null): Attribution | null {
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const a: Attribution = {
    source: clean(p.get("utm_source")),
    medium: clean(p.get("utm_medium")),
    campaign: clean(p.get("utm_campaign")),
    referrer: clean(referrer, 200),
  };
  if (!a.source && !a.medium && !a.campaign && !a.referrer) return null;
  // A bare referrer with no UTM is weak signal; keep it only if there's nothing else? Keep it — still useful.
  return a;
}

/** Parse the attribution cookie value back into an object (server-side). */
export function parseAttributionCookie(raw: string | null | undefined): Attribution | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object") return null;
    const a: Attribution = {
      source: clean(typeof o.source === "string" ? o.source : undefined),
      medium: clean(typeof o.medium === "string" ? o.medium : undefined),
      campaign: clean(typeof o.campaign === "string" ? o.campaign : undefined),
      referrer: clean(typeof o.referrer === "string" ? o.referrer : undefined, 200),
    };
    if (!a.source && !a.medium && !a.campaign && !a.referrer) return null;
    return a;
  } catch {
    return null;
  }
}

/** A human label for grouping (utm_source, else referrer host, else "direct"). */
export function attributionLabel(a: Attribution | null): string {
  if (!a) return "direct";
  if (a.source) return a.source.toLowerCase();
  if (a.referrer) {
    try {
      return new URL(a.referrer).hostname.replace(/^www\./, "");
    } catch {
      return a.referrer.slice(0, 40);
    }
  }
  return "direct";
}
