/**
 * Proxy self-test — verify PROXY_URLS works (and rotates) BEFORE running the
 * Alibaba crawler. Exercises the exact Crawlee proxy path the crawlers use:
 * sends N requests to an IP-echo service through the configured proxies and
 * prints the egress IP each time, so you can confirm (a) the proxy connects and
 * (b) the IP rotates across the pool.
 *
 *   cd deploy/collector && npm install
 *   export PROXY_URLS="http://user:pass@gw1:8000,http://user:pass@gw2:8000"
 *   node proxy-check.mjs            # default 6 probes
 *   PROXY_PROBES=10 node proxy-check.mjs
 *
 * No PROXY_URLS → reports your DIRECT egress IP (useful baseline; this is the IP
 * Alibaba would see and block without a proxy).
 */
import { HttpCrawler, Configuration } from "crawlee";
import { buildProxyConfiguration, UA, log } from "./crawlee-shared.mjs";

Configuration.getGlobalConfig().set("persistStorage", false);

const PROBES = Number(process.env.PROXY_PROBES || 6);
const ECHO = "https://api.ipify.org?format=json";

async function main() {
  const proxyConfiguration = buildProxyConfiguration();
  if (!proxyConfiguration) {
    log.warning("PROXY_URLS is not set — testing your DIRECT connection (no proxy).");
  }

  const ips = new Map(); // egress IP -> count
  let ok = 0;
  let failed = 0;

  const crawler = new HttpCrawler({
    proxyConfiguration,
    maxConcurrency: 1, // serialize so rotation is observable one probe at a time
    maxRequestRetries: 2,
    requestHandlerTimeoutSecs: 30,
    useSessionPool: true,
    // Force a new session per request so the pool actually rotates proxies.
    sessionPoolOptions: { sessionOptions: { maxUsageCount: 1 } },
    additionalMimeTypes: ["application/json"],
    preNavigationHooks: [
      async ({ request }) => {
        request.headers = { ...request.headers, "user-agent": UA, accept: "application/json" };
      },
    ],
    async requestHandler({ body, json, proxyInfo }) {
      const data = json || JSON.parse(body.toString());
      const ip = data?.ip || "unknown";
      ips.set(ip, (ips.get(ip) || 0) + 1);
      ok++;
      log.info(`probe ${ok + failed}/${PROBES}: egress IP ${ip}${proxyInfo?.url ? ` via ${new URL(proxyInfo.url).host}` : ""}`);
    },
    failedRequestHandler() {
      failed++;
      log.warning(`probe ${ok + failed}/${PROBES}: FAILED (proxy unreachable / blocked)`);
    },
  });

  // Unique keys so identical URLs aren't deduped by the request queue.
  await crawler.run(
    Array.from({ length: PROBES }, (_, i) => ({ url: ECHO, uniqueKey: `probe-${i}` })),
  );

  log.info("─".repeat(48));
  log.info(`probes: ${ok} ok, ${failed} failed`);
  log.info(`distinct egress IPs: ${ips.size}`);
  for (const [ip, n] of ips) log.info(`  ${ip} × ${n}`);
  if (proxyConfiguration) {
    if (ok === 0) log.error("All probes failed — check PROXY_URLS credentials/host/port.");
    else if (ips.size === 1) log.warning("Only ONE egress IP — proxy works but is NOT rotating (sticky/single upstream). Fine for light use; add more upstreams for Alibaba scale.");
    else log.info("Rotation confirmed — proxy pool is healthy for the Alibaba crawler.");
  }
  process.exit(failed > 0 && ok === 0 ? 1 : 0);
}

main().catch((e) => {
  log.error(e?.stack || String(e));
  process.exit(1);
});
