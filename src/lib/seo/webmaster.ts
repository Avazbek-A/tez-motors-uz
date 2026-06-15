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
  clicks?: number;
  impressions?: number;
}

export async function bingStats(): Promise<BingStats> {
  if (!process.env.BING_WEBMASTER_KEY) return { configured: false, verified: false };
  const [data, traffic] = await Promise.all([
    bingCall("GetUserSites"),
    bingCall(`GetRankAndTrafficStats?siteUrl=${encodeURIComponent("https://tezmotors.uz")}`),
  ]);
  const sites = (data?.d as { Url?: string; IsVerified?: boolean }[] | undefined) || [];
  const site = sites.find((s) => String(s.Url || "").includes("tezmotors.uz"));
  const rows = (traffic?.d as { Clicks?: number; Impressions?: number }[] | undefined) || [];
  return {
    configured: true,
    verified: !!site?.IsVerified,
    url: site?.Url,
    clicks: rows.reduce((a, r) => a + (Number(r.Clicks) || 0), 0),
    impressions: rows.reduce((a, r) => a + (Number(r.Impressions) || 0), 0),
  };
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
  topQueries?: { query: string; shows: number; clicks: number }[];
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
  // Popular search queries (empty until the host is fully crawled — graceful).
  const pq = await yandexCall(`/user/${uid}/hosts/${host.host_id}/search-queries/popular/?order_by=TOTAL_CLICKS&query_indicator=TOTAL_SHOWS&query_indicator=TOTAL_CLICKS&limit=5`);
  const topQueries = ((pq?.queries as { query_text?: string; indicators?: { TOTAL_SHOWS?: number; TOTAL_CLICKS?: number } }[] | undefined) || []).map((q) => ({
    query: q.query_text || "?",
    shows: Math.round(q.indicators?.TOTAL_SHOWS ?? 0),
    clicks: Math.round(q.indicators?.TOTAL_CLICKS ?? 0),
  }));
  return {
    configured: true,
    verified: !!host.verified,
    loaded: true,
    sqi: (summary.sqi as number) ?? null,
    searchablePages: (summary.searchable_pages_count as number) ?? null,
    excludedPages: (summary.excluded_pages_count as number) ?? null,
    topQueries,
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
      b64({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/webmasters", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
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
  topPages?: { page: string; clicks: number; impressions: number; ctr: number }[];
  // High-impression, low-CTR pages — titles/snippets worth improving.
  fixCtrPages?: { page: string; impressions: number; ctr: number }[];
}

export async function googleStats(): Promise<GoogleStats> {
  if (!process.env.GOOGLE_SA_KEY_FILE) return { configured: false };
  const token = await googleToken();
  if (!token) return { configured: false };
  // GSC data lags ~2–3 days; window = last 28 days ending 3 days ago.
  const day = 86_400_000;
  const endDate = new Date(Date.now() - 3 * day).toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 31 * day).toISOString().slice(0, 10);
  const [totals, byQuery, byPage] = await Promise.all([
    gscQuery(token, { startDate, endDate }),
    gscQuery(token, { startDate, endDate, dimensions: ["query"], rowLimit: 5 }),
    gscQuery(token, { startDate, endDate, dimensions: ["page"], rowLimit: 25 }),
  ]);
  const t = totals?.rows?.[0];
  const rel = (u?: string) => (u || "").replace("https://tezmotors.uz", "");
  const pages = (byPage?.rows || []).map((r) => ({
    page: rel(r.keys?.[0]),
    clicks: Math.round(r.clicks ?? 0),
    impressions: Math.round(r.impressions ?? 0),
    ctr: r.impressions ? Math.round(((r.clicks ?? 0) / r.impressions) * 1000) / 10 : 0,
  }));
  return {
    configured: true,
    clicks28d: Math.round(t?.clicks ?? 0),
    impressions28d: Math.round(t?.impressions ?? 0),
    avgPosition: t?.position != null ? Math.round(t.position * 10) / 10 : null,
    topQueries: (byQuery?.rows || []).map((r) => ({ query: r.keys?.[0] || "?", clicks: Math.round(r.clicks ?? 0), impressions: Math.round(r.impressions ?? 0) })),
    topPages: pages.slice(0, 6),
    // ≥50 impressions but <1% CTR = the snippet isn't earning clicks.
    fixCtrPages: pages.filter((p) => p.impressions >= 50 && p.ctr < 1).sort((a, b) => b.impressions - a.impressions).slice(0, 5).map((p) => ({ page: p.page, impressions: p.impressions, ctr: p.ctr })),
  };
}

// ─── Google index coverage (URL Inspection API) ───────────────────────────────
export interface IndexCoverage {
  configured: boolean;
  checked: number;
  indexed: number;
  notIndexed: { label: string; path: string; state: string }[];
}

export async function googleIndexCoverage(items: { url: string; path: string; label: string }[]): Promise<IndexCoverage> {
  const token = await googleToken();
  if (!token) return { configured: false, checked: 0, indexed: 0, notIndexed: [] };
  const results: { label: string; path: string; state: string; indexed: boolean }[] = [];
  const queue = [...items];
  const worker = async () => {
    while (queue.length) {
      const it = queue.shift();
      if (!it) break;
      try {
        const res = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ inspectionUrl: it.url, siteUrl: GSC_SITE }),
        });
        const data = (await res.json()) as { inspectionResult?: { indexStatusResult?: { coverageState?: string } } };
        const state = data?.inspectionResult?.indexStatusResult?.coverageState || (res.ok ? "unknown" : "error");
        const indexed = state.toLowerCase().includes("indexed") && !state.toLowerCase().includes("not indexed");
        results.push({ label: it.label, path: it.path, state, indexed });
      } catch {
        results.push({ label: it.label, path: it.path, state: "error", indexed: false });
      }
    }
  };
  // Modest concurrency — URL Inspection is ~600/min; 5 workers is safe + polite.
  await Promise.all(Array.from({ length: 5 }, worker));
  return {
    configured: true,
    checked: results.length,
    indexed: results.filter((r) => r.indexed).length,
    notIndexed: results.filter((r) => !r.indexed).map((r) => ({ label: r.label, path: r.path, state: r.state })),
  };
}

// ─── Programmatic sitemap re-submission ───────────────────────────────────────
// Bing isn't here: it has no key-API sitemap-submit endpoint (it auto-discovers
// from robots.txt + IndexNow), so there's nothing to call.
const SITEMAP_URL = "https://tezmotors.uz/sitemap.xml";

export async function googleSubmitSitemap(): Promise<{ ok: boolean; status: number }> {
  const token = await googleToken();
  if (!token) return { ok: false, status: 0 };
  try {
    const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/sitemaps/${encodeURIComponent(SITEMAP_URL)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    return { ok: res.ok, status: res.status }; // 204 = submitted
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function yandexSubmitSitemap(): Promise<{ ok: boolean; status: number }> {
  const tok = process.env.YANDEX_WEBMASTER_OAUTH;
  if (!tok) return { ok: false, status: 0 };
  const user = await yandexCall("/user/");
  const uid = user?.user_id;
  if (!uid) return { ok: false, status: 0 };
  const hosts = await yandexCall(`/user/${uid}/hosts/`);
  const list = (hosts?.hosts as { host_id?: string; unicode_host_url?: string }[] | undefined) || [];
  const host = list.find((h) => String(h.unicode_host_url || "").startsWith("https://tezmotors.uz")) || list[0];
  if (!host?.host_id) return { ok: false, status: 0 };
  try {
    const res = await fetch(`${YBASE}/user/${uid}/hosts/${host.host_id}/user-added-sitemaps/`, {
      method: "POST",
      headers: { Authorization: `OAuth ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: SITEMAP_URL }),
    });
    return { ok: res.ok || res.status === 409, status: res.status }; // 201 new, 409 already-added
  } catch {
    return { ok: false, status: 0 };
  }
}
