/**
 * AutoHome CN spec crawler — Crawlee edition (Phase AUTOHOME).
 *
 * Batch-imports full multi-trim parameter configurations from car.autohome.com.cn
 * into the catalog. Built on the same Crawlee stack as the OLX/Alibaba crawlers:
 * a fingerprinted PlaywrightCrawler with a rotating session pool (banned sessions
 * auto-retired), retries+backoff, and an optional proxy (PROXY_URLS) — though recon
 * proved a single render per model from a residential UZ IP is NOT blocked, so the
 * default (no proxy) is fine at the dealer's volume.
 *
 * Pipeline per series: render → read window.config + the injected hs_kw::before map
 * (autohome-extract.mjs) → deterministic decode (no vision/OCR) → translate CN→RU/UZ/EN
 * (cn-spec-dict.mjs, static dict + optional LLM fallback) → output.
 *
 * Targets come from argv (series ids / config URLs) OR a JSON file mapping each to a
 * catalog car id, e.g. AUTOHOME_TARGETS_FILE=./targets.json with
 *   [{ "url": "https://car.autohome.com.cn/config/series/5769.html", "carId": "<uuid>" }]
 *
 * Output:
 *   default  → writes a REVIEWABLE ./autohome-specs.json (no DB writes) — safe to inspect.
 *   --write  → ALSO upserts cars.spec_data (+ spec_captured_at) for targets with a carId,
 *              using SUPABASE_SERVICE_ROLE_KEY from .env.local (run on the Vostro).
 *
 * Usage (on the box):
 *   npm run autohome -- 5769 5569 692            # decode + write JSON for review
 *   AUTOHOME_TARGETS_FILE=./targets.json npm run autohome -- --write   # decode + save to cars
 *   LLM_API_URL=… LLM_API_KEY=… npm run autohome -- 5769   # enable LLM fallback for rare terms
 */
import { readFileSync, writeFileSync } from "node:fs";
import { PlaywrightCrawler, Configuration } from "crawlee";
import { baseCrawlerOptions, log } from "./crawlee-shared.mjs";
import { readPageData, buildSpecFromConfig, seriesIdFromUrl } from "./autohome-extract.mjs";
import { translateSpec } from "./cn-spec-dict.mjs";

Configuration.getGlobalConfig().set("persistStorage", false);

const ARGS = process.argv.slice(2);
const WRITE = ARGS.includes("--write");
const OUT = process.env.AUTOHOME_OUT || "./autohome-specs.json";
const seriesUrl = (id) => `https://car.autohome.com.cn/config/series/${id}.html`;

function loadTargets() {
  const file = process.env.AUTOHOME_TARGETS_FILE;
  if (file) {
    try {
      const arr = JSON.parse(readFileSync(file, "utf8"));
      return arr.map((t) => ({ url: t.url || seriesUrl(t.seriesId), carId: t.carId || null })).filter((t) => /^https?:/.test(t.url));
    } catch (e) { log.error(`couldn't read AUTOHOME_TARGETS_FILE: ${e.message}`); process.exit(1); }
  }
  const ids = ARGS.filter((a) => !a.startsWith("--"));
  return ids.map((a) => ({ url: /^https?:/.test(a) ? a : seriesUrl(a), carId: null }));
}

// --- optional LLM fallback translator (env-gated, fail-open) — for the long-tail CN terms ---
function makeLlmTranslator() {
  const url = process.env.LLM_API_URL, key = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || "qwen2.5:7b-instruct";
  if (!url) return undefined;
  const chatUrl = url.replace(/\/$/, "") + (/\/chat\/completions$/.test(url) ? "" : "/chat/completions");
  return async (terms) => {
    const sys = "You translate Chinese automotive spec terms. Return ONLY strict JSON mapping each input term to {\"en\":\"\",\"ru\":\"\",\"uz\":\"\"} (Uzbek Latin). Keep numbers/units. No prose.";
    const body = JSON.stringify({ model, temperature: 0, max_tokens: 1500, messages: [{ role: "system", content: sys }, { role: "user", content: JSON.stringify(terms) }] });
    try {
      const res = await fetch(chatUrl, { method: "POST", headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) }, body, signal: AbortSignal.timeout(30000) });
      if (!res.ok) return {};
      const j = await res.json();
      const txt = j?.choices?.[0]?.message?.content || "";
      return JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
    } catch { return {}; }
  };
}

async function main() {
  const targets = loadTargets();
  if (!targets.length) { log.error("no targets — pass series ids/urls or set AUTOHOME_TARGETS_FILE"); process.exit(1); }
  log.info(`AutoHome: ${targets.length} target(s)${WRITE ? " (--write: will upsert cars.spec_data)" : " (JSON only)"}`);
  const translateUnknown = makeLlmTranslator();
  if (!translateUnknown) log.info("no LLM_API_URL — dict-only translation (unknown CN terms pass through raw)");

  const results = [];
  const crawler = new PlaywrightCrawler({
    ...baseCrawlerOptions({ maxConcurrency: 1 }), // gentle: one model at a time
    navigationTimeoutSecs: 40,
    launchContext: { launchOptions: { headless: true } },
    // AutoHome holds long-poll sockets, so 'load'/'networkidle' hang — use domcontentloaded.
    preNavigationHooks: [async (_ctx, gotoOptions) => { gotoOptions.waitUntil = "domcontentloaded"; }],
    async requestHandler({ page, request, session }) {
      const title = (await page.title()).toLowerCase();
      if (/验证|滑动|安全验证|captcha|robot|访问验证/.test(title)) { session?.markBad(); throw new Error("captcha/block wall"); }
      // Wait for the embedded config var + injected hs_kw CSS to materialize.
      await page.waitForFunction(
        () => !!(window.config && window.config.result && Array.isArray(window.config.result.paramtypeitems) && window.config.result.paramtypeitems.length),
        null, { timeout: 25000 },
      ).catch(() => {});
      await page.waitForTimeout(1100);
      const { config, hsMap } = await readPageData(page);
      const spec = buildSpecFromConfig({ config, hsMap, sourceUrl: request.url });
      if (!spec) { session?.markBad(); throw new Error("config not found (soft-block or layout change)"); }
      const translated = await translateSpec(spec, { translateUnknown });
      translated.carId = request.userData?.carId || null;
      results.push(translated);
      const params = spec.trims[0] ? Object.values(spec.trims[0].params).reduce((a, g) => a + Object.keys(g).length, 0) : 0;
      log.info(`✓ series ${spec.series_id}: ${spec.trims.length} trims, ${params} params/trim` +
        (translated.untranslated.labels.length || translated.untranslated.values.length
          ? `  (untranslated: ${translated.untranslated.labels.length} labels, ${translated.untranslated.values.length} values)` : "  (fully translated)"));
    },
    failedRequestHandler({ request }) {
      log.warning(`failed after retries: ${request.url} — blocked or layout changed. Retry later; PROXY_URLS if persistent.`);
    },
  });

  await crawler.run(targets.map((t) => ({ url: t.url, userData: { carId: t.carId } })));

  if (!results.length) { log.error("0 specs extracted — likely blocked. Retry from a residential IP, or set PROXY_URLS."); process.exit(2); }
  writeFileSync(OUT, JSON.stringify(results, null, 2));
  log.info(`wrote ${results.length} spec(s) → ${OUT}`);

  if (WRITE) await upsertToCars(results);
  else log.info("review the JSON, then re-run with --write (and AUTOHOME_TARGETS_FILE mapping carId) to save to cars.spec_data");
}

async function upsertToCars(results) {
  const withCar = results.filter((r) => r.carId);
  if (!withCar.length) { log.warning("--write set but no targets had a carId — nothing to upsert (use AUTOHOME_TARGETS_FILE)"); return; }
  let env = {};
  try { for (const line of readFileSync(".env.local", "utf8").split("\n")) { const i = line.indexOf("="); if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); } } catch {}
  const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const keySr = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !keySr) { log.error("--write needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.local)"); return; }
  const { createClient } = await import("@supabase/supabase-js").catch(() => ({}));
  if (!createClient) { log.error("npm i @supabase/supabase-js in deploy/collector to use --write"); return; }
  const sb = createClient(url, keySr);
  let ok = 0;
  for (const r of withCar) {
    // Store a clean spec_data — drop the crawler's bookkeeping (carId, untranslated).
    const { carId, untranslated, ...clean } = r;
    const { error } = await sb.from("cars").update({ spec_data: clean, spec_captured_at: new Date().toISOString() }).eq("id", carId);
    if (error) log.error(`  car ${carId}: ${error.message}`); else { ok++; log.info(`  ↑ car ${carId} ← series ${r.series_id}`); }
  }
  log.info(`upserted spec_data for ${ok}/${withCar.length} car(s)`);
}

main().catch((e) => { log.error(e?.stack || String(e)); process.exit(1); });
