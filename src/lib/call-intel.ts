/**
 * Call intelligence (Phase AM).
 *
 * Most UZ car deals close on a phone call, but the call channel was invisible.
 * This summarizes a logged call (LLM, fail-open) and scores buying intent from
 * the transcript. `callLeadScore` is a pure deterministic heuristic (unit-tested)
 * that also serves as the fallback when no LLM is configured.
 */
import { llmText } from "./llm";

// High-intent buying signals (RU/UZ/EN), lightly weighted.
const INTENT_TERMS = [
  "куплю", "покупаю", "беру", "оплат", "депозит", "рассрочк", "кредит", "когда могу забрать",
  "тест-драйв", "приеду", "наличие", "цена", "скидк", "бронир",
  "sotib ol", "to'lov", "bo'lib to'lash", "narx", "chegirma", "band qil", "test drayv",
  "buy", "purchase", "deposit", "installment", "financing", "test drive", "price", "discount", "reserve", "in stock",
];
const NEGATIVE_TERMS = ["просто спрашиваю", "не интересно", "подумаю", "дорого", "later", "just looking", "too expensive", "not interested"];

/**
 * 0–100 buying-intent score from a transcript + call duration. Longer calls and
 * more distinct intent phrases score higher; negative phrases damp it. Pure.
 */
export function callLeadScore(transcript: string, durationSec = 0): number {
  const t = (transcript || "").toLowerCase();
  if (!t.trim()) return 0;
  let hits = 0;
  for (const term of INTENT_TERMS) if (t.includes(term)) hits += 1;
  let negatives = 0;
  for (const term of NEGATIVE_TERMS) if (t.includes(term)) negatives += 1;

  // Duration: a 5+ minute call is engaged; cap the bonus.
  const durBonus = Math.min(20, Math.floor(Math.max(0, durationSec) / 60) * 4);
  const raw = hits * 12 + durBonus - negatives * 15;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export interface CallAnalysis {
  summary: string;
  leadScore: number;
  ai: boolean;
}

/**
 * Summarize + score a call. LLM summary when configured (fail-open to a
 * truncated transcript); score always from the deterministic heuristic so it's
 * consistent and never depends on the model.
 */
export async function analyzeCall(transcript: string, durationSec = 0): Promise<CallAnalysis> {
  const leadScore = callLeadScore(transcript, durationSec);
  const clean = (transcript || "").trim();
  if (!clean) return { summary: "", leadScore: 0, ai: false };

  const system = [
    "You summarize a sales phone call for a Chinese-car importer in Tashkent.",
    "Output 1-3 short bullet points: what the customer wants, their intent level, and the next action.",
    "Be factual — use only what's in the transcript. No preamble.",
  ].join(" ");
  const out = await llmText({ system, user: `Call transcript:\n${clean.slice(0, 6000)}`, maxTokens: 200 });
  return {
    summary: out?.trim() || clean.slice(0, 280),
    leadScore,
    ai: Boolean(out),
  };
}
