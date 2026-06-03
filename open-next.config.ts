import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Incremental cache: DISABLED so deploys don't require R2 (which must be enabled
// per-account in the Cloudflare dashboard). The site works fine without it —
// prerendered pages (catalog/brand/city) still serve; only durable ISR/data-cache
// shared between isolates is lost.
//
// TO RE-ENABLE (recommended once R2 is on — free tier, better caching):
//   1. Cloudflare dashboard → R2 → Enable.
//   2. Restore the import + override here and the [[r2_buckets]] binding in
//      wrangler.toml:
//        import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
//        export default defineCloudflareConfig({ incrementalCache: r2IncrementalCache });
export default defineCloudflareConfig({});
