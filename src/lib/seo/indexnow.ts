/**
 * IndexNow — instant URL submission to Bing + Yandex (the two engines that matter
 * for the UZ market; Google doesn't support it but discovers the sitemap anyway).
 *
 * No account or login needed: hosting the key file at `${BASE}/${INDEXNOW_KEY}.txt`
 * proves control. We ping on every car create/update so new/changed listings get
 * indexed within minutes instead of waiting for the next crawl.
 *
 * The key is PUBLIC by design (it sits in the URL). It MUST match the file
 * public/<key>.txt — keep them in sync.
 */
export const INDEXNOW_KEY = "ac0acca5ba2ade12a7b652db2f746a8c";

const HOST = "tezmotors.uz";
const BASE = `https://${HOST}`;
const LOCALES = ["ru", "uz", "en"] as const;
const MAX_URLS = 10_000; // IndexNow per-request cap

/** All three locale URLs for a locale-less path, e.g. "/catalog/byd-song-2024". */
export function localeUrls(path: string): string[] {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return LOCALES.map((l) => `${BASE}/${l}${clean === "/" ? "" : clean}`);
}

/**
 * Submit URLs to IndexNow. Fail-soft (never throws — indexing is best-effort and
 * must never break a write). Dedupes + caps + filters to our own https origin.
 */
export async function pingIndexNow(urls: string[]): Promise<{ ok: boolean; submitted: number; status?: number }> {
  const urlList = [...new Set(urls)].filter((u) => u.startsWith(`${BASE}/`)).slice(0, MAX_URLS);
  if (!urlList.length) return { ok: true, submitted: 0 };
  try {
    const res = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key: INDEXNOW_KEY,
        keyLocation: `${BASE}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
    });
    return { ok: res.ok, submitted: urlList.length, status: res.status };
  } catch {
    return { ok: false, submitted: 0 };
  }
}

/** Fire-and-forget ping for a single car's locale URLs (use after create/update). */
export function pingCar(slug: string): void {
  if (!slug) return;
  void pingIndexNow(localeUrls(`/catalog/${slug}`));
}
