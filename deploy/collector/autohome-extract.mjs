/**
 * AutoHome CN spec extractor — the proven, deterministic engine (Phase AUTOHOME).
 *
 * Recon (2026-06-08) established that car.autohome.com.cn/config pages:
 *  - embed the FULL config as clean JSON in `window.config` (+ `option`/`bag`):
 *      result.paramtypeitems[] → { name, paramitems[] → { name, valueitems[] → {specid,value} } }
 *      result.speclist[]       → { specid }   (trim list; names live in the 车型名称 row)
 *  - obfuscate SOME labels/values with EMPTY <span class="hs_kwNN_<suffix>"></span>
 *    placeholders whose text is supplied by JS-injected CSS `::before{content:"真字"}`
 *    rules. NOT a font/glyph shuffle — the content is the literal real string, so the
 *    decode is 100% deterministic: read the ::before map, substitute the spans.
 *  - the <suffix> is randomized per page load, so the JSON spans and the CSS map MUST
 *    be read from the SAME render.
 *
 * No vision, no OCR, no proxy. One Playwright render per series. From a residential
 * UZ IP this is not blocked at the dealer's volume.
 *
 * CLI (quick test):   node autohome-extract.mjs "https://car.autohome.com.cn/config/series/5769.html"
 * Library:            import { extractAutohomeSpec, openBrowser } from "./autohome-extract.mjs"
 */
import { chromium } from "playwright";

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Pure: replace hs_kw placeholder spans with their mapped text, strip any other tags. */
export function deobfuscate(str, hsMap) {
  if (typeof str !== "string") return str == null ? "" : String(str);
  return str
    .replace(/<span\s+class=['"](hs_kw\d+_\w+)['"]\s*>\s*<\/span>/gi, (_, cls) => (hsMap && hsMap[cls]) || "")
    .replace(/<[^>]+>/g, "")
    .replace(/ /g, " ")
    .trim();
}

/** series id from a config URL (…/config/series/5769.html or /config/spec/76156.html). */
export function seriesIdFromUrl(url) {
  const m = String(url).match(/\/config\/(?:series|spec)\/(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Run INSIDE a Playwright page: pull the config vars + the injected hs_kw::before map. */
export async function readPageData(page) {
  return page.evaluate(() => {
    const map = {};
    for (const sheet of Array.from(document.styleSheets)) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; } // cross-origin sheet → skip
      for (const r of Array.from(rules || [])) {
        const sel = r.selectorText;
        if (sel && /\.hs_kw\d+_\w+::before/.test(sel)) {
          const m = sel.match(/\.(hs_kw\d+_\w+)::before/);
          let c = (r.style && r.style.content) || "";
          c = c.replace(/^["']|["']$/g, "").replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
          if (m && c && c !== "normal") map[m[1]] = c;
        }
      }
    }
    const grab = (v) => (v && v.result ? v.result : v) || null;
    return { config: grab(window.config), option: grab(window.option), bag: grab(window.bag), hsMap: map };
  });
}

/** Pure: shape the decoded config.result into our SpecData (Chinese labels; translate downstream). */
export function buildSpecFromConfig({ config, hsMap, sourceUrl }) {
  if (!config || !Array.isArray(config.paramtypeitems)) return null;
  const specids = (config.speclist || []).map((s) => s.specid).filter((x) => x != null);

  // Locate the "model name" + "guide price" rows to name + price each trim.
  const allParams = config.paramtypeitems.flatMap((g) => g.paramitems || []);
  const nameRow = allParams.find((p) => /车型名称|车型$|车款/.test(deobfuscate(p.name, hsMap))) || allParams[0];
  const priceRow = allParams.find((p) => /厂商指导价|指导价|官方价/.test(deobfuscate(p.name, hsMap)));
  const byId = (row) => {
    const m = new Map();
    for (const v of row?.valueitems || []) m.set(v.specid, deobfuscate(String(v.value ?? ""), hsMap));
    return m;
  };
  const names = byId(nameRow), prices = byId(priceRow);

  const order = specids.length ? specids : (nameRow?.valueitems || []).map((v) => v.specid);
  const trims = order.map((specid, i) => ({
    specid,
    name: names.get(specid) || `Trim ${i + 1}`,
    price_raw: prices.get(specid) || null,
    params: {},
  }));
  const idx = new Map(trims.map((t, i) => [t.specid, i]));

  const groups = [];
  for (const g of config.paramtypeitems) {
    const gName = deobfuscate(g.name, hsMap);
    if (!gName) continue;
    if (!groups.includes(gName)) groups.push(gName);
    for (const p of g.paramitems || []) {
      const pName = deobfuscate(p.name, hsMap);
      if (!pName) continue;
      for (const v of p.valueitems || []) {
        const ti = idx.get(v.specid);
        if (ti == null) continue;
        const val = deobfuscate(String(v.value ?? ""), hsMap);
        if (val && val !== "-") (trims[ti].params[gName] ||= {})[pName] = val;
      }
    }
  }

  return {
    source: "cn",
    source_url: sourceUrl,
    captured_at: new Date().toISOString(),
    series_id: config.seriesid || seriesIdFromUrl(sourceUrl) || undefined,
    brand: undefined, // CN labels are Chinese; brand/model resolved by caller (dict/global match)
    model: undefined,
    groups,
    trims: trims.map(({ specid, name, price_raw, params }) => ({ specid, name, price_raw, params })),
  };
}

/** Open a shared browser (caller closes it). */
export async function openBrowser() {
  return chromium.launch({ headless: true });
}

/**
 * Render one config URL with a ROBUST wait (AutoHome holds long-poll sockets, so
 * `networkidle` never fires — wait for window.config + the hs_kw map instead),
 * then extract + decode → SpecData. Pass a shared `browser` for batch runs.
 */
export async function extractAutohomeSpec(url, { browser, timeoutMs = 30000 } = {}) {
  const own = !browser;
  const b = browser || (await openBrowser());
  const ctx = await b.newContext({ userAgent: UA, locale: "zh-CN", viewport: { width: 1400, height: 1600 } });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    const title = (await page.title()).toLowerCase();
    if (/验证|滑动|安全验证|captcha|robot|访问验证/.test(title)) return { ok: false, blocked: true };
    await page.waitForFunction(
      () => !!(window.config && window.config.result && Array.isArray(window.config.result.paramtypeitems) && window.config.result.paramtypeitems.length),
      null,
      { timeout: timeoutMs },
    );
    await page.waitForTimeout(1200); // let the ::before rules inject
    const { config, hsMap } = await readPageData(page);
    const spec = buildSpecFromConfig({ config, hsMap, sourceUrl: url });
    if (!spec) return { ok: false, blocked: false, reason: "no_config" };
    return { ok: true, spec, hsMapSize: Object.keys(hsMap).length };
  } catch (e) {
    return { ok: false, blocked: false, reason: e?.message || String(e) };
  } finally {
    await ctx.close();
    if (own) await b.close();
  }
}

// --- CLI ---
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2] || "https://car.autohome.com.cn/config/series/5769.html";
  const res = await extractAutohomeSpec(url);
  if (!res.ok) { console.error("extract failed:", res); process.exit(1); }
  const s = res.spec;
  const paramCount = s.trims[0] ? Object.values(s.trims[0].params).reduce((a, g) => a + Object.keys(g).length, 0) : 0;
  console.log(`series ${s.series_id} — ${s.trims.length} trims, ${s.groups.length} groups, ${paramCount} params/trim (hsMap ${res.hsMapSize})`);
  console.log("trims:", s.trims.map((t) => `${t.name}${t.price_raw ? ` (${t.price_raw})` : ""}`).join("  |  "));
  console.log("groups:", s.groups.join(" · "));
  const g0 = s.groups[0];
  console.log(`\n[${g0}] sample:`);
  for (const [k, v] of Object.entries(s.trims[0].params[g0] || {}).slice(0, 12)) {
    console.log(`  ${k}: ${s.trims.map((t) => t.params[g0]?.[k] ?? "—").join(" | ")}`);
  }
}
