/**
 * SSRF-safe `fetch` that manually follows redirects so the URL guard runs on
 * EVERY hop — not just the entry URL.
 *
 * Why this exists. The handful of routes that pull an admin-supplied URL into
 * our infrastructure (media-ingest, car-spec-ingest, parts/mirror-images) all
 * validate the entry URL with `isSafeRemoteUrl`. Without manual redirect
 * handling, a public attacker URL can 301 to `http://169.254.169.254/...`
 * (link-local metadata) / `http://10.0.0.1/...` / `http://127.0.0.1/...` and
 * the runtime's automatic `redirect: "follow"` would happily fetch from the
 * private network on our behalf. This helper re-runs the guard per hop, caps
 * the chain at 5, and resolves relative `Location` headers against the
 * current URL.
 *
 * Each caller in the codebase had its own copy of this loop — three copies of
 * the same security-critical code is one accidental edit away from a real
 * SSRF. This module is the single source of truth. The callers' bespoke
 * needs (per-hop Referer, custom timeout, body) live in the `init` /
 * `getHeaders` knobs below.
 */
import { isSafeRemoteUrl } from "./media-ingest";

export interface SafeFetchOptions extends Omit<RequestInit, "redirect"> {
  /** Max hops before throwing. Default 5. */
  maxRedirects?: number;
  /** Overall budget for the whole chain, in ms. Default 15_000. */
  timeoutMs?: number;
  /**
   * Compute per-hop headers (e.g. a Referer that matches the *current* origin,
   * which hotlink CDNs require). If provided, these headers are merged on top
   * of `init.headers` for each hop. Useful when the redirect targets a
   * different host than the entry URL.
   */
  getHeaders?: (currentUrl: string) => HeadersInit | undefined;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_REDIRECTS = 5;

export async function safeFetch(
  url: string,
  opts: SafeFetchOptions = {},
): Promise<Response> {
  const { maxRedirects = DEFAULT_MAX_REDIRECTS, timeoutMs = DEFAULT_TIMEOUT_MS, getHeaders, ...init } = opts;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let current = url;
    for (let hop = 0; hop <= maxRedirects; hop++) {
      if (!isSafeRemoteUrl(current)) {
        throw new Error(`unsafe target after ${hop} hop(s)`);
      }
      const headers = new Headers(init.headers);
      const perHop = getHeaders?.(current);
      if (perHop) {
        const h = new Headers(perHop);
        h.forEach((v, k) => headers.set(k, v));
      }
      const res = await fetch(current, {
        ...init,
        headers,
        signal: ctrl.signal,
        redirect: "manual",
      });
      if (res.status < 300 || res.status >= 400) return res;
      const loc = res.headers.get("location");
      if (!loc) return res;
      try {
        current = new URL(loc, current).toString();
      } catch {
        throw new Error("invalid redirect Location");
      }
    }
    throw new Error(`too many redirects (> ${maxRedirects})`);
  } finally {
    clearTimeout(t);
  }
}
