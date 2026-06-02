/**
 * Extract structured car listings from pasted raw text (OLX search results, a
 * Telegram channel dump, etc.) using the LLM. Fail-open: with no LLM_API_KEY it
 * returns [] and the dealer adds rows manually. The dealer always reviews the
 * parsed rows before they're saved, so a wrong parse never silently pollutes
 * the market dataset.
 */
import { llmText } from "./llm";

export interface ParsedListing {
  brand: string;
  model: string;
  year?: number | null;
  mileage_km?: number | null;
  price_raw?: number | null;
  currency?: "USD" | "UZS" | null;
  city?: string | null;
  condition?: "new" | "used" | null;
}

function coerce(arr: unknown): ParsedListing[] {
  if (!Array.isArray(arr)) return [];
  const out: ParsedListing[] = [];
  for (const r of arr) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const brand = typeof o.brand === "string" ? o.brand.trim() : "";
    const model = typeof o.model === "string" ? o.model.trim() : "";
    if (!brand || !model) continue;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || null);
    const cur = typeof o.currency === "string" ? o.currency.toUpperCase() : null;
    out.push({
      brand: brand.slice(0, 60),
      model: model.slice(0, 80),
      year: o.year != null ? Math.min(Math.max(Number(o.year) || 0, 1990), 2035) || null : null,
      mileage_km: num(o.mileage_km),
      price_raw: num(o.price_raw ?? o.price),
      currency: cur === "USD" || cur === "UZS" ? (cur as "USD" | "UZS") : null,
      city: typeof o.city === "string" ? o.city.slice(0, 60) : null,
      condition: o.condition === "new" || o.condition === "used" ? o.condition : null,
    });
    if (out.length >= 60) break;
  }
  return out;
}

export async function parseListings(rawText: string): Promise<ParsedListing[]> {
  const text = (rawText || "").slice(0, 8000);
  if (text.trim().length < 4) return [];

  const system = [
    "You extract used/new CAR listings from messy marketplace text (OLX, Telegram car channels) in Uzbekistan.",
    "Return ONLY a JSON array. Each item: {brand, model, year, mileage_km, price_raw, currency, city, condition}.",
    "price_raw is the NUMBER only (no separators). currency is 'USD' (for $, у.е., y.e.) or 'UZS' (for сум, so'm).",
    "If a price is like '180 млн' treat it as 180000000 UZS. condition is 'new' or 'used' if stated, else null.",
    "Omit entries that are not a specific car with a price. Output nothing but the JSON array.",
  ].join(" ");

  const out = await llmText({ system, user: text, maxTokens: 1500 });
  if (!out) return [];
  try {
    const start = out.indexOf("[");
    const end = out.lastIndexOf("]");
    if (start === -1 || end === -1) return [];
    return coerce(JSON.parse(out.slice(start, end + 1)));
  } catch {
    return [];
  }
}
