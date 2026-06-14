/**
 * AutoHome spec extraction → structured multi-trim config for the spec sheet.
 *
 * Two sources (layered, most-bulletproof-first):
 *  - GLOBAL (global.autohome.com/.../config/spec/{id}) — a Next.js app that
 *    embeds the FULL spec data, clean + in English, in <script id="__NEXT_DATA__">.
 *    Plain fetch + JSON parse: no browser, no obfuscation. This module owns it.
 *  - CN (car.autohome.com.cn/config/...) — font/pseudo-element obfuscated; handled
 *    off-Workers by the Vostro Playwright extractor (screenshots → vision LLM),
 *    see deploy/collector/extractor.mjs + src/lib/llm.ts llmVision (Phase AD-2).
 *
 * parseGlobalAutohome() is pure (unit-tested); fetchGlobalAutohomeSpec() adds the
 * single fetch and is fail-open (returns null on any error).
 */

export interface SpecTrim {
  name: string;
  price_raw: string | null;
  year?: number | null;
  /** group name -> (param name -> value), values copied verbatim from AutoHome. */
  params: Record<string, Record<string, string>>;
}

/** A localized projection of a spec: translated group names + trims (same params shape). */
export interface LocalizedSpecView {
  groups: string[];
  trims: SpecTrim[];
}

/**
 * An exterior or interior color option, harvested from AutoHome's config-page
 * `var color` / `var innerColor` JSON. `hex` is the swatch (dual-tone interiors
 * come as "#aaaaaa/#bbbbbb"); `images` are the re-hosted key photos for that
 * color (≤10 exterior / ≤15 interior), category-diverse + deduped.
 */
export interface CarColor {
  name_cn: string;
  name_ru?: string;
  name_uz?: string;
  name_en?: string;
  hex: string;
  color_id?: number;
  images?: string[];
}

export interface SpecData {
  source: "global" | "cn";
  source_url: string;
  captured_at: string;
  brand?: string;
  model?: string;
  /** AutoHome series id — used to fetch the full image gallery. */
  series_id?: number;
  /**
   * AutoHome panorama id for the 360° walkthrough (exterior spin + interior VR).
   * Embedded as https://pano.autohome.com.cn/car/pano/{pano_id} — same approach
   * the competitor uses. Different id-space from series_id.
   */
  pano_id?: string | null;
  /**
   * AutoHome video media id for the car overview clip. Resolved at request time
   * to a fresh signed mp4 via /api/video/{mid} and streamed direct from
   * AutoHome's CDN (no download/storage).
   */
  video_mid?: string | null;
  /**
   * True once the overview mp4 has been downloaded to the Vostro disk
   * (IMAGE_STORE_DIR/videos/{video_mid}.mp4). The player then serves it locally
   * via /api/video/{mid}/file (fast from UZ) instead of streaming from China.
   */
  video_local?: boolean;
  /**
   * Per-locale WebVTT subtitle tracks for the overview clip. Generated offline
   * (local Whisper STT of the Chinese narration → translation), stored only for
   * clips that actually contain speech (music-only b-roll has none). Served as a
   * <track> via /api/video/{mid}/subtitles?lang=…; absent → no subtitle toggle.
   */
  subtitles?: Partial<Record<"ru" | "uz" | "en", string>>;
  /** ordered group names (Basic Information, Body, Electric Motor, …). */
  groups: string[];
  trims: SpecTrim[];
  gallery?: string[];
  colors?: string[];
  /** Exterior body colors (AutoHome `var color`): name + hex + key photos per color. */
  exterior_colors?: CarColor[];
  /** Interior colors (AutoHome `var innerColor`): name + hex + key photos per color. */
  interior_colors?: CarColor[];
  /**
   * Customs-clearance (растаможка) estimate in USD, scraped from the matched
   * Gonzo detail page's "Таможня" figure. A frequently-asked number — shown as an
   * estimate on the car page (confirm-with-manager), never a hard all-in commitment.
   */
  customs_usd?: number;
  /**
   * Per-trim CIP-Tashkent prices from the matched Gonzo detail page, each already
   * −$100 (the catalog's pricing rule). Gonzo's exact labels + prices — the
   * authoritative price list shown on the car page. AutoHome trims are matched to
   * these at render time (best-effort) to head spec-compare columns with a price.
   */
  gonzo_trims?: { label: string; price_usd: number }[];
  /**
   * Per-locale translated views (ru/uz/en). Present for CN-sourced specs whose
   * base groups/trims are Chinese — produced by the collector's CN→RU/UZ/EN
   * dictionary (deploy/collector/cn-spec-dict.mjs). Absent for global-EN specs.
   */
  i18n?: Partial<Record<"ru" | "uz" | "en", LocalizedSpecView>>;
}

/**
 * The right {groups, trims} to display for a locale: the translated `i18n[locale]`
 * view when present (CN specs), else the base fields (global-EN specs). Pure.
 */
export function localizedSpecView(spec: SpecData, locale: "ru" | "uz" | "en"): LocalizedSpecView {
  const v = spec.i18n?.[locale];
  if (v && Array.isArray(v.groups) && Array.isArray(v.trims) && v.trims.length) return v;
  return { groups: spec.groups, trims: spec.trims };
}

/** Internal/provenance keys that must never reach public clients — they ride inside
 *  the spec_data jsonb but are not rendered, and they reveal the upstream source /
 *  AutoHome ids. Collectors read the DB directly with the service key, so stripping
 *  these from the PUBLIC projection doesn't affect scraping. */
const INTERNAL_SPEC_KEYS = ["source", "source_url", "captured_at", "series_id", "confidence", "untranslated", "brand", "model"];

/** Return spec_data safe to send to anonymous visitors: display fields only
 *  (groups, trims, i18n, colors, gallery, 360/video, customs/gonzo prices). Pure. */
export function stripPublicSpecData(spec: SpecData | null | undefined): SpecData | null {
  if (!spec || typeof spec !== "object") return (spec as SpecData | null) ?? null;
  const out: Record<string, unknown> = { ...spec };
  for (const k of INTERNAL_SPEC_KEYS) delete out[k];
  // Internal keys are intentionally absent from the public projection; the UI only
  // reads display fields, so the SpecData shape is satisfied at the use sites.
  return out as unknown as SpecData;
}

type TrimSignals = { dt: string; pt: string; kwh: number; seats: number; long: boolean };

/** Extract drivetrain / powertrain / battery-kWh / seats signals from a trim label
 *  (handles both Chinese AutoHome names and English Gonzo labels). */
function trimSignals(text: string, params?: Record<string, Record<string, string>>): TrimSignals {
  const s = String(text || "").toLowerCase();
  let dt = "";
  if (/四驱|4wd|awd|双电机|全时四驱|four[- ]?wheel|all[- ]?wheel/.test(s)) dt = "awd";
  else if (/后驱|rwd|后轮|rear[- ]?wheel|单电机/.test(s)) dt = "rwd";
  else if (/前驱|fwd|前轮|front[- ]?wheel/.test(s)) dt = "fwd";
  let pt = "";
  if (/增程|erev|range[- ]?extend|extended[- ]?range/.test(s)) pt = "erev";
  else if (/插电|phev|plug[- ]?in/.test(s)) pt = "phev";
  else if (/油电|混动|hybrid|\bhev\b/.test(s)) pt = "hybrid";
  else if (/纯电|純電|\bev\b|electric|\bbev\b/.test(s)) pt = "ev";
  let kwh = 0;
  const km = s.match(/(\d{2,3}(?:\.\d)?)\s*(?:kwh|kw·h|度|千瓦时)/);
  if (km) kwh = Math.round(parseFloat(km[1]));
  if (!kwh && params) {
    for (const g of Object.values(params)) {
      for (const [k, v] of Object.entries(g)) {
        if (/电池|battery|容量|电量|квтч|кВтч/i.test(k) && /^\d{2,3}(\.\d+)?$/.test(String(v))) {
          const n = parseFloat(String(v));
          if (n >= 20 && n <= 200) { kwh = Math.round(n); break; }
        }
      }
      if (kwh) break;
    }
  }
  let seats = 0;
  const sm = s.match(/(\d)\s*(?:座|seat|мест)/);
  if (sm) seats = parseInt(sm[1], 10);
  const long = /长续航|長續航|long[- ]?range/.test(s);
  return { dt, pt, kwh, seats, long };
}

function sigScore(a: TrimSignals, b: TrimSignals): number {
  let sc = 0;
  if (a.dt && a.dt === b.dt) sc += 2; else if (a.dt && b.dt) sc -= 2;
  if (a.pt && a.pt === b.pt) sc += 2; else if (a.pt && b.pt) sc -= 2;
  if (a.kwh && b.kwh) sc += a.kwh === b.kwh ? 3 : -2;
  if (a.seats && b.seats && a.seats === b.seats) sc += 1;
  if (a.long && b.long) sc += 1;
  return sc;
}

/**
 * Best-effort map of each AutoHome trim → a Gonzo per-trim USD price, aligned to
 * `trims` by index. Conservative: only assigns on a confident signal match
 * (drivetrain/powertrain/battery), so the spec-compare column headers never show a
 * wrong price. Falls back to price-rank alignment only when the counts are equal.
 * Returns nulls when there's nothing confident — the car page still shows the exact
 * Gonzo list as the authoritative source. Pure.
 */
export function matchGonzoToTrims(
  trims: SpecTrim[],
  gonzo?: { label: string; price_usd: number }[],
): (number | null)[] {
  if (!gonzo?.length || !trims.length) return trims.map(() => null);
  const gs = gonzo.map((g) => ({ price: g.price_usd, sig: trimSignals(g.label) }));
  const out: (number | null)[] = trims.map((t) => {
    const ts = trimSignals(t.name, t.params);
    let best: number | null = null, bestSc = 2; // require > 2 to assign
    for (const g of gs) { const sc = sigScore(ts, g.sig); if (sc > bestSc) { bestSc = sc; best = g.price; } }
    return best;
  });
  if (!out.some((x) => x !== null) && trims.length === gonzo.length) {
    const rawNum = (t: SpecTrim) => parseFloat(String(t.price_raw || "").replace(/[^\d.]/g, "")) || 0;
    const order = [...trims.keys()].sort((a, b) => rawNum(trims[a]) - rawNum(trims[b]));
    const gp = [...gonzo].sort((a, b) => a.price_usd - b.price_usd);
    order.forEach((ti, i) => { if (gp[i]) out[ti] = gp[i].price_usd; });
  }
  return out;
}

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export function isAutohomeGlobalUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === "global.autohome.com" || h.endsWith(".global.autohome.com");
  } catch {
    return false;
  }
}

export function isAutohomeCnConfigUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    return (h.endsWith("autohome.com.cn")) && /\/config\//.test(u.pathname);
  } catch {
    return false;
  }
}

// --- global __NEXT_DATA__ shapes (only the fields we read) ---
interface NextItem { itemName?: string; titleId?: number; values?: (string | number | null)[] }
interface NextGroup { itemType?: string; items?: NextItem[] }
interface NextTrim {
  specName?: string;
  year?: number;
  price?: number;
  priceUnit?: string;
  formatPrice?: string;
  paramconfList?: { titleId?: number; itemName?: string }[];
}
interface NextInit {
  bread?: { brandName?: string; seriesName?: string; seriesId?: number };
  titlelist?: NextGroup[];
  datalist?: NextTrim[];
}

/** Build the global AutoHome image-gallery URL for a series (same host+locale). */
export function autohomeGlobalImageUrl(sourceUrl: string, seriesId: number): string | null {
  if (!seriesId) return null;
  try {
    const u = new URL(sourceUrl);
    const seg = u.pathname.split("/").filter(Boolean);
    const locale = seg[0] && /^[a-z]{2}-[a-z]{2}$/i.test(seg[0]) ? seg[0] : "en-hk";
    return `${u.protocol}//${u.host}/${locale}/image/series/${seriesId}`;
  } catch {
    return null;
  }
}

function trimPrice(t: NextTrim): string | null {
  const f = (t.formatPrice || "").trim();
  if (f && !/no quotation|暂无|n\/a/i.test(f)) return f;
  if (typeof t.price === "number" && t.price > 0) return `${t.priceUnit || ""}${t.price.toLocaleString("en-US")}`.trim();
  return null;
}

/** Pure: parse a global.autohome.com config page's HTML into SpecData. */
export function parseGlobalAutohome(html: string, sourceUrl: string): SpecData | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let init: NextInit;
  try {
    init = (JSON.parse(m[1])?.props?.pageProps?.initData ?? {}) as NextInit;
  } catch {
    return null;
  }
  const titlelist = Array.isArray(init.titlelist) ? init.titlelist : [];
  const datalist = Array.isArray(init.datalist) ? init.datalist : [];
  if (titlelist.length === 0 || datalist.length === 0) return null;

  const groups = titlelist.map((g) => (g.itemType || "").trim()).filter(Boolean);

  const trims: SpecTrim[] = datalist.map((t, ti) => {
    // Per-trim value lookup by titleId from this trim's paramconfList (fallback).
    const byTitle = new Map<number, string>();
    for (const p of t.paramconfList ?? []) {
      if (typeof p.titleId === "number" && p.itemName != null) byTitle.set(p.titleId, String(p.itemName));
    }
    const params: Record<string, Record<string, string>> = {};
    for (const g of titlelist) {
      const gName = (g.itemType || "").trim();
      if (!gName) continue;
      const section: Record<string, string> = {};
      for (const it of g.items ?? []) {
        const pName = (it.itemName || "").trim();
        if (!pName) continue;
        // Prefer the group's per-trim values[] (clean), else this trim's paramconfList.
        let v: string | null = null;
        if (Array.isArray(it.values) && it.values[ti] != null) v = String(it.values[ti]);
        else if (typeof it.titleId === "number" && byTitle.has(it.titleId)) v = byTitle.get(it.titleId)!;
        if (v != null && v !== "" && v !== "-") section[pName] = v;
      }
      if (Object.keys(section).length > 0) params[gName] = section;
    }
    return { name: (t.specName || `Trim ${ti + 1}`).trim(), price_raw: trimPrice(t), year: t.year || null, params };
  });

  return {
    source: "global",
    source_url: sourceUrl,
    captured_at: new Date().toISOString(),
    brand: init.bread?.brandName?.trim(),
    model: init.bread?.seriesName?.trim(),
    series_id: typeof init.bread?.seriesId === "number" ? init.bread.seriesId : undefined,
    groups,
    trims,
  };
}

/**
 * Normalize a vision LLM's JSON (read from screenshots of an obfuscated CN config
 * page) into SpecData. Tolerant: strips code fences, finds the first JSON object,
 * accepts `{brand?, model?, trims:[{name, price?, params:{group:{k:v}}}]}`.
 * Returns null if it can't recover a usable structure.
 */
export function parseVisionSpec(raw: string, sourceUrl: string): SpecData | null {
  if (!raw) return null;
  // Defense in depth: the LLM output is UNTRUSTED (a hostile screenshot could
  // coax a megabyte response). Cap before JSON.parse so we don't tie up the
  // worker. 256 KB is comfortable headroom for even the chattiest config page.
  const MAX_VISION_BYTES = 256 * 1024;
  let text = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  if (text.length > MAX_VISION_BYTES) text = text.slice(0, MAX_VISION_BYTES);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  text = text.slice(start, end + 1);
  if (text.length > MAX_VISION_BYTES) return null;
  let obj: { brand?: unknown; model?: unknown; trims?: unknown };
  try {
    obj = JSON.parse(text);
  } catch {
    return null;
  }
  const rawTrims = Array.isArray(obj.trims) ? obj.trims : [];
  const groupOrder: string[] = [];
  const trims: SpecTrim[] = [];
  for (const rt of rawTrims) {
    if (!rt || typeof rt !== "object") continue;
    const t = rt as { name?: unknown; price?: unknown; price_raw?: unknown; year?: unknown; params?: unknown };
    const params: Record<string, Record<string, string>> = {};
    const rp = t.params && typeof t.params === "object" ? (t.params as Record<string, unknown>) : {};
    for (const [g, section] of Object.entries(rp)) {
      if (!section || typeof section !== "object") continue;
      const gName = String(g).trim();
      if (!gName) continue;
      if (!groupOrder.includes(gName)) groupOrder.push(gName);
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(section as Record<string, unknown>)) {
        const kk = String(k).trim();
        const vv = v == null ? "" : String(v).trim();
        if (kk && vv && vv !== "-") out[kk] = vv;
      }
      if (Object.keys(out).length) params[gName] = out;
    }
    const price = t.price_raw ?? t.price;
    trims.push({
      name: String(t.name ?? `Trim ${trims.length + 1}`).trim(),
      price_raw: price != null && String(price).trim() ? String(price).trim() : null,
      year: typeof t.year === "number" ? t.year : null,
      params,
    });
  }
  if (trims.length === 0 || groupOrder.length === 0) return null;
  return {
    source: "cn",
    source_url: sourceUrl,
    captured_at: new Date().toISOString(),
    brand: typeof obj.brand === "string" ? obj.brand.trim() : undefined,
    model: typeof obj.model === "string" ? obj.model.trim() : undefined,
    groups: groupOrder,
    trims,
  };
}

/**
 * Pure: read the AutoHome series id from a global page's __NEXT_DATA__. Works even
 * when initData is empty (client-rendered pages) — pageProps.seriesId is still set.
 * The series id powers the image-gallery scrape.
 */
export function extractGlobalSeriesId(html: string): number | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const pp = JSON.parse(m[1])?.props?.pageProps ?? {};
    const sid = pp?.initData?.bread?.seriesId ?? pp?.seriesId;
    const n = typeof sid === "number" ? sid : Number(sid);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * Fetch a global AutoHome config URL and return BOTH the parsed spec (null when
 * the page renders its data client-side, i.e. empty initData) and the series id
 * (available even then). Fail-open. The caller falls back to the browser
 * extractor + vision when `spec` is null.
 */
export async function fetchGlobalAutohome(url: string): Promise<{ spec: SpecData | null; seriesId: number | null }> {
  if (!isAutohomeGlobalUrl(url)) return { spec: null, seriesId: null };
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { spec: null, seriesId: null };
    const html = (await res.text()).slice(0, 6_000_000);
    return { spec: parseGlobalAutohome(html, url), seriesId: extractGlobalSeriesId(html) };
  } catch {
    return { spec: null, seriesId: null };
  }
}

/** Fetch + parse a global AutoHome config URL. Fail-open to null. */
export async function fetchGlobalAutohomeSpec(url: string): Promise<SpecData | null> {
  return (await fetchGlobalAutohome(url)).spec;
}
