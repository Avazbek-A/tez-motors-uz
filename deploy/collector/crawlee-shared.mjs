/**
 * Shared Crawlee plumbing for the tez-motors crawling layer.
 *
 * Why Crawlee (Node/TS — same stack as the app, no Python runtime to maintain on
 * the Vostro): it gives every crawler managed request queues, automatic retries
 * with backoff, a rotating session pool, optional proxy rotation, realistic
 * browser fingerprints, and concurrency control — the robustness the old naive
 * `fetch`-loop collectors lacked. Each target (OLX, Alibaba parts, …) is a thin
 * crawler on top of these helpers; this module owns the cross-cutting policy.
 *
 * Everything here is fail-open / env-gated, mirroring the app's conventions:
 *  - PROXY_URLS unset  → direct connection (fine for low-anti-bot targets).
 *  - INGEST_URL/MARKET_INGEST_SECRET unset → ingest() throws a clear error.
 *
 * Run on the dealer's box (Node 18+). Never bundled into the Workers build.
 */
import { readFileSync } from "node:fs";
import { ProxyConfiguration, log } from "crawlee";

export const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Build a Crawlee ProxyConfiguration from env, or return undefined for a direct
 * connection. PROXY_URLS = comma-separated proxy URLs (residential/rotating).
 * This is the real anti-bot lever for hostile targets (Alibaba, social) — the
 * framework rotates across them automatically and retires banned sessions.
 *
 *   export PROXY_URLS="http://user:pass@gw1:8000,http://user:pass@gw2:8000"
 */
export function buildProxyConfiguration() {
  const raw = (process.env.PROXY_URLS || "").trim();
  if (!raw) return undefined;
  const proxyUrls = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (proxyUrls.length === 0) return undefined;
  log.info(`proxy: rotating across ${proxyUrls.length} upstream(s)`);
  return new ProxyConfiguration({ proxyUrls });
}

/**
 * Common Crawlee options every crawler should share: bounded concurrency (gentle
 * by default — respect target ToS), generous retries with Crawlee's built-in
 * backoff, and a session pool so a banned IP/cookie set is rotated out instead of
 * failing the whole run. Override per-target by spreading + replacing keys.
 */
export function baseCrawlerOptions(overrides = {}) {
  const maxConcurrency = Number(process.env.CRAWL_MAX_CONCURRENCY || 4);
  return {
    maxRequestRetries: Number(process.env.CRAWL_MAX_RETRIES || 5),
    requestHandlerTimeoutSecs: 90,
    maxConcurrency,
    // Session pool: rotate cookies/identity, retire on block automatically.
    useSessionPool: true,
    sessionPoolOptions: {
      maxPoolSize: Math.max(10, maxConcurrency * 3),
      sessionOptions: { maxUsageCount: 30, maxErrorScore: 3 },
    },
    proxyConfiguration: buildProxyConfiguration(),
    ...overrides,
  };
}

/**
 * POST normalized listings to the website's market-ingest endpoint (same contract
 * the old collectors used: { source, listings[] } + Bearer MARKET_INGEST_SECRET).
 * The server normalizes price → USD and dedupes by fingerprint. Chunks large runs.
 */
export async function ingestListings(source, listings) {
  const INGEST_URL = process.env.INGEST_URL;
  const SECRET = process.env.MARKET_INGEST_SECRET;
  if (!INGEST_URL || !SECRET) {
    throw new Error("Set INGEST_URL and MARKET_INGEST_SECRET to ingest results");
  }
  if (!listings.length) {
    log.info("nothing to ingest");
    return { stored: 0, received: 0 };
  }
  let received = 0;
  let stored = 0;
  // The endpoint caps at 500 listings/request — chunk so big sweeps don't 400.
  for (let i = 0; i < listings.length; i += 500) {
    const chunk = listings.slice(i, i + 500);
    const res = await fetch(INGEST_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ source, listings: chunk }),
    });
    const text = await res.text();
    log.info(`ingest chunk ${i / 500 + 1}: ${res.status} ${text.slice(0, 200)}`);
    if (res.ok) {
      try {
        const j = JSON.parse(text);
        received += j.received || chunk.length;
        stored += j.stored || 0;
      } catch {
        received += chunk.length;
      }
    }
  }
  return { received, stored };
}

/** Load a JSON file of searches/targets, or fall back to a built-in default. */
export function loadJsonOrDefault(envVar, fallback) {
  const f = process.env[envVar];
  if (!f) return fallback;
  try {
    return JSON.parse(readFileSync(f, "utf8"));
  } catch (e) {
    log.warning(`couldn't read ${f} (${envVar}); using defaults: ${e.message}`);
    return fallback;
  }
}

export { log };
