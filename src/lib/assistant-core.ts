/**
 * Pure, side-effect-free helpers shared by the "Find my car" assistant.
 *
 * Extracted from src/app/api/assistant/route.ts so they can be unit-tested and
 * reused by the Telegram bot (Phase U) without dragging in Next/Supabase. The
 * retrieval + DB access stays in the callers; everything here is deterministic
 * string/number math that's easy to test.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { estimatedMonthlyFrom, priceFromMonthly } from "./finance";
import { generateAssistantReply } from "./llm";
import type { Car } from "@/types/car";
import type { AssistantCarLite } from "./llm";

export const MAX_ASSISTANT_CARS = 6;

/** Strip characters that would break a Postgres trigram/ILIKE search term. */
export function sanitizeSearch(raw: string): string {
  return raw.replace(/[,()\\%*]/g, " ").replace(/\s+/g, " ").trim().slice(0, 64);
}

/**
 * Light heuristic budget parse from free text. Only ever *narrows* results, so
 * a wrong guess can't surface cars that don't match — worst case the grid is a
 * little tighter. Returns a USD price ceiling or null.
 */
export function parseBudgetCeiling(message: string): number | null {
  const lower = message.toLowerCase();
  // e.g. "$500/mo", "500 в месяц", "800 oylik"
  const monthlyMatch = lower.match(/(\d[\d\s.,]{1,9})\s*(?:\$|usd)?\s*(?:\/?\s*(?:mo|month|мес|месяц|oy|oylik))/);
  if (monthlyMatch) {
    const n = parseInt(monthlyMatch[1].replace(/[\s.,]/g, ""), 10);
    if (Number.isFinite(n) && n > 0 && n < 100000) return Math.floor(priceFromMonthly(n));
  }
  // e.g. "under $30k", "до 25000", "30 000"
  const kMatch = lower.match(/(\d{1,3})\s*k\b/);
  if (kMatch) {
    const n = parseInt(kMatch[1], 10) * 1000;
    if (n >= 3000) return n;
  }
  const rawNums = lower.match(/\d[\d\s.,]{2,9}/g);
  if (rawNums) {
    const candidates = rawNums
      .map((s) => parseInt(s.replace(/[\s.,]/g, ""), 10))
      .filter((n) => Number.isFinite(n) && n >= 3000 && n <= 100_000_000);
    if (candidates.length > 0) return Math.max(...candidates);
  }
  return null;
}

/**
 * Deterministic fallback reply used whenever the LLM is unconfigured or fails.
 * Always grounded on the real `cars` it is handed — never invents anything.
 */
export function templatedReply(locale: string, cars: Car[]): string {
  const L = locale === "uz" ? "uz" : locale === "en" ? "en" : "ru";
  if (cars.length === 0) {
    return {
      ru: "Сейчас нет авто в наличии под этот запрос. Оставьте имя и телефон — менеджер подберёт вариант под вас.",
      uz: "Hozircha bu so'rovga mos avto yo'q. Ism va telefon raqamingizni qoldiring — menejer mos variantni tanlab beradi.",
      en: "Nothing in stock matches that right now. Leave your name and phone and a manager will find an option for you.",
    }[L];
  }
  const list = cars
    .slice(0, 3)
    .map((c) => `${c.brand} ${c.model} ${c.year} — $${c.price_usd.toLocaleString("en-US")} (≈$${estimatedMonthlyFrom(c.price_usd)}/${L === "ru" ? "мес" : L === "uz" ? "oy" : "mo"})`)
    .join("; ");
  return {
    ru: `Вот что есть в наличии: ${list}. Оставьте имя и телефон — менеджер поможет с выбором и расскажет про рассрочку.`,
    uz: `Mana hozir mavjud variantlar: ${list}. Ism va telefon raqamingizni qoldiring — menejer tanlovda yordam beradi.`,
    en: `Here's what's in stock: ${list}. Leave your name and phone and a manager will help you choose and explain installments.`,
  }[L];
}

/** Project full DB cars into the lean shape the LLM prompt is handed. */
export function toAssistantCarLite(cars: Car[]): AssistantCarLite[] {
  return cars.map((c) => ({
    brand: c.brand,
    model: c.model,
    year: c.year,
    price_usd: c.price_usd,
    monthly_usd: estimatedMonthlyFrom(c.price_usd),
    body_type: c.body_type,
    fuel_type: c.fuel_type,
  }));
}

export interface RecommendResult {
  reply: string;
  cars: Car[];
  ceiling: number | null;
}

/**
 * Shared retrieval + grounded reply used by BOTH the web "Find my car" widget
 * (api/assistant) and the Telegram bot (api/bot/telegram). This is the one place
 * that decides which real cars to surface and produces the prose about them, so
 * the two channels can't drift or hallucinate differently.
 *
 * Unlike the helpers above this one touches the DB (trigram RPC + cars query) and
 * calls the LLM, but it stays free of request/auth concerns so each route layers
 * its own rate-limit / Turnstile / lead capture on top. Always grounded on real
 * inventory; the reply falls back to a deterministic template if the LLM is
 * unconfigured or fails.
 */
export async function recommendCars(
  supabase: SupabaseClient,
  opts: { message: string; locale: string },
): Promise<RecommendResult> {
  const locale = opts.locale === "uz" ? "uz" : opts.locale === "en" ? "en" : "ru";

  // Trigram RPC first, then a sensible fallback so there are always real cars.
  const q = sanitizeSearch(opts.message);
  let ids: string[] | null = null;
  if (q.length >= 2) {
    const { data: rpc } = await supabase.rpc("search_cars_ids", { q, max_results: 50 });
    if (Array.isArray(rpc) && rpc.length > 0) {
      ids = rpc.map((r: { id: string }) => r.id);
    }
  }

  const ceiling = parseBudgetCeiling(opts.message);

  let carQuery = supabase.from("cars").select("*").neq("inventory_status", "sold");
  if (ids && ids.length > 0) carQuery = carQuery.in("id", ids);
  if (ceiling !== null) carQuery = carQuery.lte("price_usd", ceiling);
  carQuery = carQuery
    .order("is_hot_offer", { ascending: false })
    .order("price_usd", { ascending: true })
    .limit(MAX_ASSISTANT_CARS);

  let { data: cars } = await carQuery;

  // Fallback: nothing matched — show available stock so the reply is never empty.
  if (!cars || cars.length === 0) {
    const { data: anyCars } = await supabase
      .from("cars")
      .select("*")
      .neq("inventory_status", "sold")
      .order("is_hot_offer", { ascending: false })
      .order("price_usd", { ascending: true })
      .limit(MAX_ASSISTANT_CARS);
    cars = anyCars || [];
  }

  const carList = (cars as Car[]) || [];

  const llmReply = await generateAssistantReply({
    locale,
    userMessage: opts.message,
    cars: toAssistantCarLite(carList),
  });
  const reply = llmReply || templatedReply(locale, carList);

  return { reply, cars: carList, ceiling };
}
