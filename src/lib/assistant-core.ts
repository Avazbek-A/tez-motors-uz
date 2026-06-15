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
import { categorizeCar } from "./car-category";
import type { Car } from "@/types/car";
import type { AssistantCarLite } from "./llm";

export const MAX_ASSISTANT_CARS = 12;

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
  return cars.map((c) => {
    const cat = categorizeCar(c);
    return {
      brand: c.brand,
      model: c.model,
      year: c.year,
      price_usd: c.price_usd,
      monthly_usd: estimatedMonthlyFrom(c.price_usd),
      body_type: c.body_type,
      fuel_type: c.fuel_type,
      segment: cat.segment,
      size_class: cat.sizeClass,
      seats: cat.seats,
      range_km: cat.rangeKm,
      horsepower: cat.horsepower,
      zero_to_100_s: cat.zeroTo100,
      drive: cat.driveType,
      use_cases: cat.useCases,
    };
  });
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

/**
 * Map stored conversation rows to the lean turn shape the LLM expects, keeping
 * only the most recent `max` (a small window bounds prompt size + cost). Pure
 * and order-preserving; unknown roles are coerced to "user".
 */
export function historyFromRows(
  rows: { role?: string | null; content?: string | null }[],
  max = 6,
): ChatTurn[] {
  const turns = rows
    .filter((r) => typeof r.content === "string" && r.content.length > 0)
    .map<ChatTurn>((r) => ({ role: r.role === "assistant" ? "assistant" : "user", content: r.content as string }));
  return turns.slice(-Math.max(0, max));
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
  opts: { message: string; locale: string; history?: ChatTurn[] },
): Promise<RecommendResult> {
  const locale = opts.locale === "uz" ? "uz" : opts.locale === "en" ? "en" : "ru";

  // ---- Parse CATEGORY intent from the message so retrieval surfaces RELEVANT
  //      cars (a 7-seat SUV for a family query, an EV for "electric", premium for
  //      "luxury") instead of just the cheapest. Mirrors sales-agent.extractSlots. ----
  const m = (opts.message || "").toLowerCase();
  const bodyType =
    /кроссовер|crossover|внедорожник|suv|джип|krossover/.test(m) ? "suv"
    : /седан|sedan/.test(m) ? "sedan"
    : /хэтч|хетч|hatch/.test(m) ? "hatchback"
    : /минивэн|минивен|minivan|микроавтобус/.test(m) ? "minivan"
    : /купе|coupe/.test(m) ? "coupe"
    : null;
  const fuel =
    /электр|electric|\bev\b|elektr/.test(m) ? "electric"
    : /плагин|phev|plug-?in/.test(m) ? "phev"
    : /гибрид|hybrid|gibrid/.test(m) ? "hybrid"
    : /дизель|diesel|dizel/.test(m) ? "diesel"
    : /бензин|petrol|gasoline|benzin/.test(m) ? "petrol"
    : null;
  const seatMatch = m.match(/(\d)\s*-?\s*(?:мест|seat|o['’]?rin|orin)/);
  const seatsMin = seatMatch ? parseInt(seatMatch[1], 10)
    : /семь[ия]|для семьи|family|оила|семимест|big.?family/.test(m) ? 6 : null;
  const premiumIntent = /люкс|премиум|luxury|premium|бизнес|business|престиж|prestige|мощн|powerful|спорт|sport|быстр|fast|tezkor/.test(m);

  const ceiling = parseBudgetCeiling(opts.message);

  // Trigram (brand/model text match) — used as one optional constraint.
  const q = sanitizeSearch(opts.message);
  let ids: string[] | null = null;
  if (q.length >= 2) {
    const { data: rpc } = await supabase.rpc("search_cars_ids", { q, max_results: 50 });
    if (Array.isArray(rpc) && rpc.length > 0) ids = rpc.map((r: { id: string }) => r.id);
  }

  // Fetch a POOL with the chosen constraints (priced only); seats are filtered in
  // JS afterwards (seat count lives in spec_data, not a column). Order cheapest-first
  // normally, priciest-first when the client signals premium/performance intent.
  const POOL = 60;
  const fetchPool = async (useIds: boolean, useCeiling: boolean, useBody: boolean, useFuel: boolean): Promise<Car[]> => {
    let qy = supabase.from("cars").select("*").neq("inventory_status", "sold").gt("price_usd", 0);
    if (useIds && ids && ids.length > 0) qy = qy.in("id", ids);
    if (useCeiling && ceiling !== null) qy = qy.lte("price_usd", ceiling);
    if (useBody && bodyType) qy = qy.eq("body_type", bodyType);
    if (useFuel && fuel) qy = qy.eq("fuel_type", fuel);
    qy = qy.order("is_hot_offer", { ascending: false }).order("price_usd", { ascending: !premiumIntent }).limit(POOL);
    const { data } = await qy;
    return (data as Car[]) || [];
  };
  const bySeats = (list: Car[]): Car[] => {
    if (!seatsMin) return list;
    const ok = list.filter((c) => (categorizeCar(c).seats ?? 0) >= seatsMin);
    return ok.length > 0 ? ok : list; // never empty the set over a soft seat signal
  };

  // Strictest → progressively relaxed, so the reply is never empty.
  let pool = bySeats(await fetchPool(true, true, true, true));
  if (pool.length === 0) pool = bySeats(await fetchPool(false, true, true, true)); // drop trigram
  if (pool.length === 0) pool = bySeats(await fetchPool(false, false, true, true)); // drop budget
  if (pool.length === 0) pool = bySeats(await fetchPool(false, true, false, false)); // drop category, keep budget
  if (pool.length === 0) pool = await fetchPool(false, false, false, false); // anything priced
  const carList = pool.slice(0, MAX_ASSISTANT_CARS);

  const llmReply = await generateAssistantReply({
    locale,
    userMessage: opts.message,
    cars: toAssistantCarLite(carList),
    history: opts.history,
  });
  const reply = llmReply || templatedReply(locale, carList);

  return { reply, cars: carList, ceiling };
}
