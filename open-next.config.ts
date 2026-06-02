import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// Persistent incremental cache backed by R2 (binding NEXT_INC_CACHE_R2_BUCKET).
// Without this, ISR / data-cache entries live only in a Worker isolate's memory
// and are lost between requests; R2 makes them durable + shared so cacheable
// pages (car detail, brand/type landing pages) serve from cache instead of
// re-rendering. The OpenNext deploy step auto-creates the bucket from the
// wrangler.toml binding.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
