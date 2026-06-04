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

export interface SpecData {
  source: "global" | "cn";
  source_url: string;
  captured_at: string;
  brand?: string;
  model?: string;
  /** ordered group names (Basic Information, Body, Electric Motor, …). */
  groups: string[];
  trims: SpecTrim[];
  gallery?: string[];
  colors?: string[];
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
  bread?: { brandName?: string; seriesName?: string };
  titlelist?: NextGroup[];
  datalist?: NextTrim[];
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
  let text = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  text = text.slice(start, end + 1);
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

/** Fetch + parse a global AutoHome config URL. Fail-open to null. */
export async function fetchGlobalAutohomeSpec(url: string): Promise<SpecData | null> {
  if (!isAutohomeGlobalUrl(url)) return null;
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 6_000_000);
    return parseGlobalAutohome(html, url);
  } catch {
    return null;
  }
}
