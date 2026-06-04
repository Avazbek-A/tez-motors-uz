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
  /** Referral code from ?ref= (word-of-mouth tracking). */
  ref?: string;
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
    ref: clean(p.get("ref") || p.get("utm_referral"), 60),
  };
  if (!a.source && !a.medium && !a.campaign && !a.referrer && !a.ref) return null;
  return a;
}

/** Parse the attribution cookie value back into an object (server-side). */
export function parseAttributionCookie(raw: string | null | undefined): Attribution | null {
  if (!raw) return null;
  // Browsers cap cookies at ~4 KB; an attacker hitting the API directly could
  // supply a megabyte string just to slow JSON.parse on every inquiry request.
  // Guard the worker.
  if (raw.length > 8 * 1024) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object") return null;
    const a: Attribution = {
      source: clean(typeof o.source === "string" ? o.source : undefined),
      medium: clean(typeof o.medium === "string" ? o.medium : undefined),
      campaign: clean(typeof o.campaign === "string" ? o.campaign : undefined),
      referrer: clean(typeof o.referrer === "string" ? o.referrer : undefined, 200),
      ref: clean(typeof o.ref === "string" ? o.ref : undefined, 60),
    };
    if (!a.source && !a.medium && !a.campaign && !a.referrer && !a.ref) return null;
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

/**
 * Coarse channel bucket aligning lead/order attribution with the channels ad
 * spend is tagged under (expenses.channel), so channel ROI can join the two.
 * Pure + unit-tested. Returns 'direct' for organic/no-source, else a known
 * channel, else the raw source label.
 */
export function channelKey(a: Attribution | null): string {
  const s = attributionLabel(a);
  if (s.includes("olx")) return "olx";
  if (s.includes("avtoelon")) return "avtoelon";
  if (s.includes("google")) return "google";
  if (s.includes("instagram") || s === "ig") return "instagram";
  if (s.includes("facebook") || s === "fb") return "facebook";
  if (s.includes("meta")) return "meta";
  if (s.includes("telegram") || s.includes("t.me")) return "telegram";
  return s; // "direct" or a named source we don't bucket
}
