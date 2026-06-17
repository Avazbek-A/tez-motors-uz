/**
 * Detect the language a customer actually WROTE in — so the bot replies in that
 * language regardless of their Telegram/WhatsApp UI locale.
 *
 * THE BUG THIS FIXES: the Telegram bot keyed the reply language off
 * `from.language_code` (the customer's *app* UI language). A Russian-speaking
 * buyer whose Telegram is set to English wrote "привет" and got an English
 * reply. WhatsApp hard-coded `ru`, so an Uzbek/English writer also got Russian.
 *
 * Returns "ru" | "uz" | "en" | null. `null` = can't tell (too short, only
 * digits / emoji / a bare model name) → the caller falls back to the channel
 * locale (Telegram UI language, WhatsApp default, or the web page locale).
 *
 * Pure + dependency-free (Workers-safe) and unit-tested. Heuristics, in order:
 *   1. Cyrillic letters present → Russian. (Uzbek is overwhelmingly written in
 *      Latin online; a Cyrillic message to this dealer is Russian in practice.)
 *   2. Latin: score Uzbek-specific markers (oʻ/gʻ/ʻ, common Uzbek words) vs
 *      common English words. Uzbek wins ties when it has any marker, because the
 *      dealer's Latin-writing customers are far more often Uzbek than English.
 *   3. No signal either way → null.
 */
export type DetectedLocale = "ru" | "uz" | "en";

// Uzbek Latin orthography uses the modifier letter turned comma (ʻ) and a few
// apostrophe lookalikes for oʻ / gʻ — strong, language-specific signals.
const UZ_APOSTROPHE = /[og]['`ʻʼ‘’]/i;

// High-signal Uzbek words (car-shopping vocabulary + function words). Matched as
// whole words so "men" doesn't fire on "moment". Latin only.
const UZ_WORDS = new Set([
  "men", "sen", "biz", "siz", "bor", "yoq", "yo", "ha", "kerak", "kerakmi",
  "qancha", "narx", "narxi", "narxlari", "mashina", "moshina", "avto", "avtomobil",
  "avtomobillar", "bormi", "qanaqa", "qanday", "salom", "assalomu", "alaykum",
  "rahmat", "yaxshi", "arzon", "qimmat", "yangi", "eski", "oyiga", "som", "somda",
  "dollar", "telefon", "raqam", "raqamim", "kredit", "boʻlib", "bolib", "tolov",
  "toʻlov", "olmoqchiman", "olaman", "qilaman", "qilsa", "mumkin", "uchun", "bilan",
  "haqida", "qiladi", "bormisiz", "qilmoqchiman", "istayman", "ko", "tola", "nechi",
]);

// Common English words — used only to decide en-vs-uz on Latin text.
const EN_WORDS = new Set([
  "the", "you", "your", "do", "does", "have", "want", "need", "looking", "hello",
  "hi", "hey", "car", "cars", "price", "prices", "how", "much", "what", "which",
  "can", "could", "would", "is", "are", "available", "stock", "buy", "interested",
  "please", "thanks", "thank", "good", "cheap", "expensive", "new", "used", "for",
  "with", "and", "about", "tell", "me", "show", "best", "monthly", "payment", "i",
]);

function words(latin: string): string[] {
  return latin.toLowerCase().match(/[a-z]+/g) || [];
}

/**
 * Best-guess language of a free-text message. Returns null when undecidable so
 * the caller can fall back to a channel/UI locale.
 */
export function detectMessageLocale(text: string | null | undefined): DetectedLocale | null {
  const raw = (text || "").trim();
  if (!raw) return null;

  // Strip URLs so a domain's Latin letters don't bias a Cyrillic message.
  const cleaned = raw.replace(/https?:\/\/\S+/gi, " ");

  const cyrillic = (cleaned.match(/[Ѐ-ӿ]/g) || []).length;
  const latin = (cleaned.match(/[a-zA-Z]/g) || []).length;

  // No letters at all (only digits / emoji / punctuation) → undecidable.
  if (cyrillic === 0 && latin === 0) return null;

  // Cyrillic dominates → Russian.
  if (cyrillic > latin) return "ru";

  // Latin path: weigh Uzbek markers against English words.
  let uz = UZ_APOSTROPHE.test(cleaned) ? 2 : 0;
  let en = 0;
  for (const w of words(cleaned)) {
    if (UZ_WORDS.has(w)) uz += 1;
    if (EN_WORDS.has(w)) en += 1;
  }

  if (uz > 0 && uz >= en) return "uz";
  if (en > 0) return "en";

  // A few Cyrillic chars mixed into mostly-Latin (rare) still implies Russian.
  if (cyrillic > 0) return "ru";

  // Latin with no language signal (e.g. a bare "byd han 2024") → undecidable.
  return null;
}

/** Convenience: detect, else fall back to the provided channel/UI locale. */
export function resolveReplyLocale(
  text: string | null | undefined,
  fallback: DetectedLocale,
): DetectedLocale {
  return detectMessageLocale(text) ?? fallback;
}
