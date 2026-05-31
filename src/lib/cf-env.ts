/**
 * Cloudflare Workers binding access for the OpenNext runtime.
 *
 * Bindings (KV, R2, …) are NOT on process.env — they live on the Cloudflare
 * context's `env`, reached via getCloudflareContext({ async: true }) from
 * @opennextjs/cloudflare. This helper centralizes that access and ALWAYS fails
 * open: if the binding is missing (local `next dev`, an unbound preview, or a
 * misconfigured deploy) it returns null and callers degrade gracefully.
 *
 * We avoid referencing the global `KVNamespace` type because
 * @cloudflare/workers-types isn't installed here; instead we expose the minimal
 * structural subset (`KvLike`) we actually use. To add a binding, add the
 * matching entry to wrangler.toml and pass its name to getKv().
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** The slice of Cloudflare's KVNamespace this app relies on. */
export interface KvLike {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Resolve a KV namespace binding by name, or null when unavailable.
 * Never throws — a thrown/absent context (e.g. outside a request, or local dev
 * without the binding) is swallowed so the caller can fall back to an
 * in-process strategy.
 */
export async function getKv(name: string): Promise<KvLike | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const binding = (env as unknown as Record<string, unknown>)[name];
    if (binding && typeof (binding as KvLike).get === "function") {
      return binding as KvLike;
    }
    return null;
  } catch {
    return null;
  }
}
