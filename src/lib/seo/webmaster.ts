/**
 * Bing + Yandex Webmaster API clients (server-only — read the secret creds from
 * env). Used by /api/admin/search-stats to surface indexing health inside /admin.
 * All calls fail-soft (return null) so a missing/expired cred never breaks the page.
 *
 * Creds live in the Vostro .env.local:
 *   BING_WEBMASTER_KEY        — Bing Webmaster Tools → Settings → API Access
 *   YANDEX_WEBMASTER_OAUTH    — OAuth token with the webmaster:hostinfo scope
 */

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
