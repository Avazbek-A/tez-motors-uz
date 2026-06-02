/**
 * Sales-agent qualification layer — turns the grounded "Find my car" assistant
 * into a closer.
 *
 * Pure, deterministic, side-effect-free (so it's unit-tested and adds ZERO LLM
 * cost): from a buyer message + accumulated profile it extracts qualification
 * slots, detects a phone or buying intent in free text, scores the lead, decides
 * the sales stage, and composes a proactive nudge to append to the reply. The
 * conversational prose still comes from assistant-core's grounded recommendCars;
 * this only decides *what to ask next* and *when to hand off to a human*.
 */
import { parseBudgetCeiling } from "./assistant-core";

export type SalesStage = "greeting" | "qualifying" | "recommending" | "closing" | "handoff";

export interface SalesProfile {
  budgetUsd?: number;
  bodyType?: "suv" | "sedan" | "hatchback" | "minivan";
  fuel?: "petrol" | "diesel" | "hybrid" | "electric";
  seats?: number;
  financing?: boolean;
  timeline?: "now" | "soon";
}

export interface IntentSignal {
  /** Strong buying / commitment intent. */
  hot: boolean;
  /** Explicitly wants a human / callback. */
  wantsHuman: boolean;
  reasons: string[];
}

const has = (re: RegExp, s: string) => re.test(s);

/** Extract qualification slots from one message. Only sets what it's sure of. */
export function extractSlots(message: string): SalesProfile {
  const s = (message || "").toLowerCase();
  const out: SalesProfile = {};

  const budget = parseBudgetCeiling(message);
  if (budget != null) out.budgetUsd = budget;

  if (has(/кроссовер|crossover|внедорожник|suv|джип|krossover/, s)) out.bodyType = "suv";
  else if (has(/седан|sedan/, s)) out.bodyType = "sedan";
  else if (has(/хэтч|хетч|hatch/, s)) out.bodyType = "hatchback";
  else if (has(/минивэн|минивен|minivan|микроавтобус/, s)) out.bodyType = "minivan";

  if (has(/электр|electric|\bev\b|elektr/, s)) out.fuel = "electric";
  else if (has(/гибрид|hybrid|gibrid/, s)) out.fuel = "hybrid";
  else if (has(/дизель|diesel|dizel/, s)) out.fuel = "diesel";
  else if (has(/бензин|petrol|gasoline|benzin/, s)) out.fuel = "petrol";

  const seatMatch = s.match(/(\d)\s*-?\s*(?:мест|seat|o['’]?rin|orin)/);
  if (seatMatch) {
    const n = parseInt(seatMatch[1], 10);
    if (n >= 2 && n <= 9) out.seats = n;
  } else if (has(/семь[ия]|family|оила|для семьи|7\s*мест|7-?seat|семимест/, s)) {
    out.seats = 7;
  }

  if (has(/рассрочк|кредит|installment|financ|в рассрочку|oylik|ежемесяч|monthly|\/mo|муддатли/, s)) {
    out.financing = true;
  }

  if (has(/сейчас|сегодня|срочно|now|today|asap|на этой неделе|this week|hozir|shoshilinch/, s)) out.timeline = "now";
  else if (has(/месяц|month|скоро|soon|yaqin|keyin/, s)) out.timeline = "soon";

  return out;
}

/** Detect a phone number typed into free text. Requires ≥9 digits so budgets
 *  ("до 25000", "$500/mo") are never mistaken for a number. Returns the cleaned
 *  string (leading + preserved) or null. */
export function detectPhone(message: string): string | null {
  const m = (message || "").match(/\+?\d[\d\s\-()]{7,}\d/g);
  if (!m) return null;
  for (const raw of m) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 9 && digits.length <= 15) {
      return raw.trim().startsWith("+") ? `+${digits}` : digits;
    }
  }
  return null;
}

/** Pull a name from "меня зовут X" / "mening ismim X" / "my name is X". */
export function detectName(message: string): string | null {
  const m = (message || "").match(
    /(?:меня зовут|мо[её] имя|my name is|i am|i'm|mening ismim|ismim)\s+([A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ'’-]{2,30})/i,
  );
  return m ? m[1].replace(/['’-]+$/, "") : null;
}

/** Buying-intent / human-request detection. */
export function detectIntent(message: string): IntentSignal {
  const s = (message || "").toLowerCase();
  const reasons: string[] = [];

  const buy = /купить|покупа|беру|оформ|заброн|бронир|готов взять|хочу взять|buy|purchase|reserve|book|тест-?драйв|test\s*drive|когда могу забрать|сколько ждать|sotib ol|band qil|olmoqchi/;
  const finance = /рассрочк|в кредит|installment|financ|муддатли/;
  const human = /менеджер|manager|позвоните|перезвоните|call me|свяжитесь|оператор|человек|consultant|menejer|qo['’]ng['’]iroq/;

  const hotBuy = has(buy, s);
  const hotFin = has(finance, s);
  const wantsHuman = has(human, s);
  if (hotBuy) reasons.push("buying-intent");
  if (hotFin) reasons.push("financing-intent");
  if (wantsHuman) reasons.push("wants-human");

  return { hot: hotBuy || hotFin || wantsHuman, wantsHuman, reasons };
}

/** Merge freshly-extracted slots over the accumulated profile (new wins). */
export function mergeProfile(prev: SalesProfile | null | undefined, next: SalesProfile): SalesProfile {
  const merged: SalesProfile = { ...(prev || {}) };
  for (const [k, v] of Object.entries(next)) {
    if (v !== undefined && v !== null) (merged as Record<string, unknown>)[k] = v;
  }
  return merged;
}

/** How many qualification slots we know. */
function slotCount(p: SalesProfile): number {
  return [p.budgetUsd, p.bodyType, p.fuel, p.seats, p.financing, p.timeline].filter((v) => v != null).length;
}

export function computeStage(args: {
  profile: SalesProfile;
  messageCount: number;
  intent: IntentSignal;
  hasPhone: boolean;
}): SalesStage {
  const { profile, messageCount, intent, hasPhone } = args;
  if (hasPhone || intent.wantsHuman) return "handoff";
  if (intent.hot) return "closing";
  if (slotCount(profile) >= 1 && messageCount >= 1) return "recommending";
  if (messageCount >= 1) return "qualifying";
  return "greeting";
}

/** 0–100 lead score from profile richness + intent + contact + engagement. */
export function scoreLead(args: {
  profile: SalesProfile;
  intent: IntentSignal;
  hasPhone: boolean;
  messageCount: number;
}): number {
  const { profile, intent, hasPhone, messageCount } = args;
  let score = 0;
  if (hasPhone) score += 30;
  if (intent.hot) score += 20;
  if (intent.wantsHuman) score += 10;
  if (profile.budgetUsd != null) score += 10;
  if (profile.bodyType || profile.fuel || profile.seats != null) score += 10;
  if (profile.financing) score += 8;
  if (profile.timeline === "now") score += 7;
  score += Math.min(messageCount * 3, 15);
  return Math.max(0, Math.min(100, score));
}

const NUDGES = {
  askPhone: {
    ru: "Оставьте имя и номер — менеджер закрепит за вами авто и расскажет про рассрочку и сроки доставки.",
    uz: "Ism va telefon raqamingizni qoldiring — menejer avtoni siz uchun band qiladi va muddatli to'lov va yetkazib berish muddatlarini aytadi.",
    en: "Leave your name and number — a manager will hold the car for you and explain installments and delivery timing.",
  },
  financing: {
    ru: "Хотите, посчитаю ежемесячный платёж в рассрочку? Оставьте номер — менеджер подготовит расчёт.",
    uz: "Oylik to'lovni hisoblab beraymi? Raqamingizni qoldiring — menejer hisob-kitobni tayyorlaydi.",
    en: "Want me to estimate the monthly installment? Leave your number and a manager will prepare the figures.",
  },
  captured: {
    ru: "Спасибо! Менеджер свяжется с вами в ближайшее время.",
    uz: "Rahmat! Menejer tez orada siz bilan bog'lanadi.",
    en: "Thanks! A manager will contact you shortly.",
  },
} as const;

function L(locale: string): "ru" | "uz" | "en" {
  return locale === "uz" ? "uz" : locale === "en" ? "en" : "ru";
}

/** A short proactive line to append to the grounded reply, or null. */
export function composeNudge(
  locale: string,
  args: { stage: SalesStage; profile: SalesProfile; hasPhone: boolean },
): string | null {
  const l = L(locale);
  if (args.hasPhone) return NUDGES.captured[l];
  if (args.stage === "closing") {
    return args.profile.financing ? NUDGES.financing[l] : NUDGES.askPhone[l];
  }
  if (args.stage === "recommending") return NUDGES.askPhone[l];
  return null;
}

/** One-line human-readable profile summary for the admin oversight list. */
export function profileSummary(profile: SalesProfile): string {
  const parts: string[] = [];
  if (profile.budgetUsd != null) parts.push(`≤$${profile.budgetUsd.toLocaleString("en-US")}`);
  if (profile.bodyType) parts.push(profile.bodyType);
  if (profile.fuel) parts.push(profile.fuel);
  if (profile.seats != null) parts.push(`${profile.seats} seats`);
  if (profile.financing) parts.push("financing");
  if (profile.timeline) parts.push(profile.timeline);
  return parts.join(" · ") || "—";
}
