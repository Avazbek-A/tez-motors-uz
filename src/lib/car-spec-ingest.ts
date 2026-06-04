/**
 * Extract a car's configuration from a source page (e.g. AutoHome) into our
 * form fields. AutoHome spec tables are Chinese + JS-rendered, so instead of
 * brittle regex we strip the page to text and let the LLM map it to a strict
 * schema (with our enum values). Grounded — the model is told to use ONLY the
 * page content and omit anything it can't find. Fail-open: no LLM key, a blocked
 * fetch, or a parse failure → null (the dealer fills the form manually).
 *
 * Never extracts price — that's the dealer's landed-cost decision, not the
 * source's MSRP.
 */
import { isSafeRemoteUrl } from "./media-ingest";
import { llmText } from "./llm";

const FETCH_TIMEOUT_MS = 12_000;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const BODY_TYPES = new Set(["sedan", "suv", "hatchback", "coupe", "wagon", "van", "truck", "crossover", "minivan", "pickup"]);
const FUEL_TYPES = new Set(["petrol", "diesel", "hybrid", "electric", "phev", "gas"]);
const TRANSMISSIONS = new Set(["automatic", "manual", "cvt", "dct", "robot"]);
const DRIVETRAINS = new Set(["fwd", "rwd", "awd", "4wd"]);

export interface CarSpecDraft {
  brand?: string;
  model?: string;
  year?: number;
  body_type?: string;
  fuel_type?: string;
  transmission?: string;
  drivetrain?: string;
  engine_volume?: number;
  engine_power?: number;
  color?: string;
  /** Any extra labelled specs the model returns (free-form). */
  specs?: Record<string, string>;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

function num(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
}

function enumOrUndef(v: unknown, allowed: Set<string>): string | undefined {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return allowed.has(s) ? s : undefined;
}

const MAX_REDIRECTS = 5;

export async function extractCarSpecFromPage(pageUrl: string): Promise<CarSpecDraft | null> {
  if (!isSafeRemoteUrl(pageUrl)) return null;

  let html: string;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    // SECURITY: manually follow redirects so isSafeRemoteUrl runs on EACH hop.
    // `redirect: "follow"` would let a public attacker URL 301 to an internal
    // host (169.254.169.254 metadata, 10.x/192.168.x/127.x) and have the worker
    // fetch from the private network on our behalf, same class of bug fixed
    // earlier in media-ingest.ts and the parts mirror route.
    let current = pageUrl;
    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isSafeRemoteUrl(current)) return null;
      res = await fetch(current, {
        headers: { "user-agent": BROWSER_UA, accept: "text/html,application/xhtml+xml" },
        redirect: "manual",
        signal: ctrl.signal,
      });
      if (res.status < 300 || res.status >= 400) break;
      const loc = res.headers.get("location");
      if (!loc) break;
      try { current = new URL(loc, current).toString(); } catch { return null; }
      if (hop === MAX_REDIRECTS) return null;
    }
    if (!res || !res.ok) return null;
    html = (await res.text()).slice(0, 2_000_000);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }

  const text = htmlToText(html);
  if (text.length < 50) return null;

  const system = [
    "You extract car configuration from a car-listing page (the text may be in Chinese, e.g. AutoHome).",
    "Return STRICT JSON only, no prose:",
    '{"brand"?,"model"?,"year"?,"body_type"?,"fuel_type"?,"transmission"?,"drivetrain"?,"engine_volume"?,"engine_power"?,"color"?,"specs"?}',
    "Rules: use ONLY facts present in the text; omit any field you cannot find (do NOT guess).",
    "year = integer. engine_volume = litres (number, e.g. 1.5). engine_power = horsepower (integer; convert kW→hp ×1.341 if only kW given).",
    "body_type ∈ sedan|suv|hatchback|coupe|wagon|van|truck|crossover|minivan|pickup.",
    "fuel_type ∈ petrol|diesel|hybrid|electric|phev|gas (电动=electric, 混动/插电=hybrid/phev, 汽油=petrol, 柴油=diesel).",
    "transmission ∈ automatic|manual|cvt|dct|robot. drivetrain ∈ fwd|rwd|awd|4wd.",
    "brand/model in Latin script if known. specs = a small object of any other labelled spec pairs (English keys), max 10.",
    "NEVER output a price.",
  ].join(" ");

  const out = await llmText({ system, user: `Page text:\n${text}`, maxTokens: 700 });
  if (!out) return null;

  try {
    const parsed = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)) as Record<string, unknown>;
    const draft: CarSpecDraft = {};
    if (typeof parsed.brand === "string" && parsed.brand.trim()) draft.brand = parsed.brand.trim().slice(0, 100);
    if (typeof parsed.model === "string" && parsed.model.trim()) draft.model = parsed.model.trim().slice(0, 100);
    const year = num(parsed.year, 2000, 2035);
    if (year) draft.year = Math.round(year);
    const bt = enumOrUndef(parsed.body_type, BODY_TYPES);
    if (bt) draft.body_type = bt;
    const ft = enumOrUndef(parsed.fuel_type, FUEL_TYPES);
    if (ft) draft.fuel_type = ft;
    const tr = enumOrUndef(parsed.transmission, TRANSMISSIONS);
    if (tr) draft.transmission = tr;
    const dr = enumOrUndef(parsed.drivetrain, DRIVETRAINS);
    if (dr) draft.drivetrain = dr;
    const ev = num(parsed.engine_volume, 0, 10);
    if (ev) draft.engine_volume = ev;
    const ep = num(parsed.engine_power, 0, 2000);
    if (ep) draft.engine_power = Math.round(ep);
    if (typeof parsed.color === "string" && parsed.color.trim()) draft.color = parsed.color.trim().slice(0, 100);
    if (parsed.specs && typeof parsed.specs === "object" && !Array.isArray(parsed.specs)) {
      const specs: Record<string, string> = {};
      let n = 0;
      for (const [k, v] of Object.entries(parsed.specs as Record<string, unknown>)) {
        if (n >= 10) break;
        if (typeof k === "string" && (typeof v === "string" || typeof v === "number")) {
          specs[k.slice(0, 40)] = String(v).slice(0, 120);
          n++;
        }
      }
      if (Object.keys(specs).length > 0) draft.specs = specs;
    }
    return Object.keys(draft).length > 0 ? draft : null;
  } catch {
    return null;
  }
}
