/**
 * Bing + Yandex + Google Webmaster API clients (server-only — read the secret
 * creds from env). Used by /api/admin/search-stats to surface indexing/search
 * health inside /admin. All calls fail-soft (return null) so a missing/expired
 * cred never breaks the page.
 *
 * Creds live in the Vostro .env.local:
 *   BING_WEBMASTER_KEY        — Bing Webmaster Tools → Settings → API Access
 *   YANDEX_WEBMASTER_OAUTH    — OAuth token with the webmaster:hostinfo scope
 *   GOOGLE_SA_KEY_FILE        — path to a Google service-account JSON (added as a
 *                               user on the Search Console property)
 */
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

// ─── Bing ─────────────────────────────────────────────────────────────────────
async function bingCall(path: string): Promise<Record<string, unknown> | null> {
  const key = process.env.BING_WEBMASTER_KEY;
  if (!key) return null;
  try {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`https://ssl.bing.com/webmaster/api.svc/json/${path}${sep}apikey=${key}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export interface BingStats {
  configured: boolean;
  verified: boolean;
  url?: string;
}

export async function bingStats(): Promise<BingStats> {
  if (!process.env.BING_WEBMASTER_KEY) return { configured: false, verified: false };
  const data = await bingCall("GetUserSites");
  const sites = (data?.d as { Url?: string; IsVerified?: boolean }[] | undefined) || [];
  const site = sites.find((s) => String(s.Url || "").includes("tezmotors.uz"));
  return { configured: true, verified: !!site?.IsVerified, url: site?.Url };
}

// ─── Yandex ───────────────────────────────────────────────────────────────────
const YBASE = "https://api.webmaster.yandex.net/v4";

async function yandexCall(path: string): Promise<Record<string, unknown> | null> {
  const tok = process.env.YANDEX_WEBMASTER_OAUTH;
  if (!tok) return null;
  try {
    const res = await fetch(`${YBASE}${path}`, { headers: { Authorization: `OAuth ${tok}` }, cache: "no-store" });
    return (await res.json().catch(() => null)) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

export interface YandexStats {
  configured: boolean;
  verified: boolean;
  loaded: boolean; // false until Yandex has crawled the freshly-verified host
  sqi?: number | null; // Site Quality Index
  searchablePages?: number | null;
  excludedPages?: number | null;
  status?: string; // e.g. HOST_NOT_LOADED
}

export async function yandexStats(): Promise<YandexStats> {
  if (!process.env.YANDEX_WEBMASTER_OAUTH) return { configured: false, verified: false, loaded: false };
  const user = await yandexCall("/user/");
  const uid = user?.user_id;
  if (!uid) return { configured: true, verified: false, loaded: false };
  const hosts = await yandexCall(`/user/${uid}/hosts/`);
  const list = (hosts?.hosts as { host_id?: string; unicode_host_url?: string; verified?: boolean }[] | undefined) || [];
  const host = list.find((h) => String(h.unicode_host_url || "").startsWith("https://tezmotors.uz")) || list[0];
  if (!host?.host_id) return { configured: true, verified: false, loaded: false };
  const summary = await yandexCall(`/user/${uid}/hosts/${host.host_id}/summary`);
  if (!summary || summary.error_code) {
    return { configured: true, verified: !!host.verified, loaded: false, status: (summary?.error_code as string) || "no_data" };
  }
  return {
    configured: true,
    verified: !!host.verified,
    loaded: true,
    sqi: (summary.sqi as number) ?? null,
    searchablePages: (summary.searchable_pages_count as number) ?? null,
    excludedPages: (summary.excluded_pages_count as number) ?? null,
  };
}

// ─── Google (Search Console API via service account) ──────────────────────────
const GSC_SITE = "sc-domain:tezmotors.uz"; // Domain property (verified by DNS)
let gToken: { token: string; exp: number } | null = null;

async function googleToken(): Promise<string | null> {
  const keyFile = process.env.GOOGLE_SA_KEY_FILE;
  if (!keyFile) return null;
  if (gToken && gToken.exp > Date.now() + 60_000) return gToken.token;
  try {
    const sa = JSON.parse(readFileSync(keyFile, "utf8")) as { client_email: string; private_key: string };
    const now = Math.floor(Date.now() / 1000);
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const unsigned =
      b64({ alg: "RS256", typ: "JWT" }) +
      "." +
      b64({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
    const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
    const tok = (await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
    }).then((r) => r.json())) as { access_token?: string; expires_in?: number };
    if (!tok.access_token) return null;
    gToken = { token: tok.access_token, exp: Date.now() + (tok.expires_in ?? 3600) * 1000 };
    return tok.access_token;
  } catch {
    return null;
  }
}

async function gscQuery(token: string, body: object): Promise<{ rows?: { keys?: string[]; clicks?: number; impressions?: number; position?: number }[] } | null> {
  try {
    const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as { rows?: { keys?: string[]; clicks?: number; impressions?: number; position?: number }[] };
  } catch {
    return null;
  }
}

export interface GoogleStats {
  configured: boolean;
  clicks28d?: number;
  impressions28d?: number;
  avgPosition?: number | null;
  topQueries?: { query: string; clicks: number; impressions: number }[];
}

export async function googleStats(): Promise<GoogleStats> {
  if (!process.env.GOOGLE_SA_KEY_FILE) return { configured: false };
  const token = await googleToken();
  if (!token) return { configured: false };
  // GSC data lags ~2–3 days; window = last 28 days ending 3 days ago.
  const day = 86_400_000;
  const endDate = new Date(Date.now() - 3 * day).toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 31 * day).toISOString().slice(0, 10);
  const [totals, byQuery] = await Promise.all([
    gscQuery(token, { startDate, endDate }),
    gscQuery(token, { startDate, endDate, dimensions: ["query"], rowLimit: 5 }),
  ]);
  const t = totals?.rows?.[0];
  return {
    configured: true,
    clicks28d: Math.round(t?.clicks ?? 0),
    impressions28d: Math.round(t?.impressions ?? 0),
    avgPosition: t?.position != null ? Math.round(t.position * 10) / 10 : null,
    topQueries: (byQuery?.rows || []).map((r) => ({ query: r.keys?.[0] || "?", clicks: Math.round(r.clicks ?? 0), impressions: Math.round(r.impressions ?? 0) })),
  };
}
