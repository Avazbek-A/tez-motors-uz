/**
 * Call intelligence (Phase AM).
 *
 * Most UZ car deals close on a phone call, but the call channel was invisible.
 * This summarizes a logged call (LLM, fail-open) and scores buying intent from
 * the transcript. `callLeadScore` is a pure deterministic heuristic (unit-tested)
 * that also serves as the fallback when no LLM is configured.
 */
import { llmText } from "./llm";

/**
 * Normalize an LLM `summary` field to clean text. Some free models return it as an
 * ARRAY of bullet strings instead of a single string — without this the UI/bot would
 * show raw JSON like `["...","..."]`. Arrays become newline-joined "• " bullets.
 */
export function normalizeCallSummary(s: unknown): string {
  if (Array.isArray(s)) {
    return s
      .map((x) => String(x).trim())
      .filter(Boolean)
      .map((x) => (/^[•\-*]/.test(x) ? x : `• ${x}`))
      .join("\n");
  }
  return typeof s === "string" ? s.trim() : "";
}

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
  metadata?: {
    extracted_entities: {
      budget: number | null;
      car_model: string | null;
      payment_pref: string | null;
      urgency: "hot" | "warm" | "cold";
      closing_probability: number;
      closing_probability_reason: string;
    };
    compliance_checklist: {
      greeted_properly: boolean;
      offered_test_drive: boolean;
      mentioned_warranty: boolean;
      scheduled_followup: boolean;
    };
    compliance_score: number;
    sentiment: "positive" | "neutral" | "negative" | "frustrated";
    follow_up_draft: string;
  };
}

/**
 * Summarize + score a call bilingually. LLM summary + structured metadata (entities,
 * compliance audit, sentiment, follow-up messages) extracted.
 */
export async function analyzeCall(transcript: string, durationSec = 0): Promise<CallAnalysis> {
  const leadScore = callLeadScore(transcript, durationSec);
  const clean = (transcript || "").trim();
  if (!clean) {
    return {
      summary: "",
      leadScore: 0,
      ai: false,
      metadata: {
        extracted_entities: { budget: null, car_model: null, payment_pref: null, urgency: "cold", closing_probability: 25, closing_probability_reason: "Нет данных для оценки." },
        compliance_checklist: { greeted_properly: false, offered_test_drive: false, mentioned_warranty: false, scheduled_followup: false },
        compliance_score: 0,
        sentiment: "neutral",
        follow_up_draft: "",
      }
    };
  }

  const system = [
    "You are an AI sales analyst for Tez Motors, a premium Chinese-car importer in Tashkent.",
    "Analyze the call transcript (which may contain a mix of Russian and Uzbek code-switching) and output a JSON object with this exact structure:",
    "{",
    '  "summary": "1-3 bullet points in Russian summarizing customer requests and next action.",',
    '  "extracted_entities": {',
    '    "budget": 25000, // budget in USD (number or null)',
    '    "car_model": "BYD Song Plus", // matched car model or null',
    '    "payment_pref": "cash" | "leasing" | "installment" | null,',
    '    "urgency": "hot" | "warm" | "cold", // cold: just browsing, warm: within 1-2 weeks, hot: ready to buy now/deposit',
    '    "closing_probability": 75, // probability percentage 0 to 100 representing the likelihood of closing a deal based on discussion metrics',
    '    "closing_probability_reason": "Explanation in Russian of why this probability was assigned based on buy signals/objections."',
    "  },",
    '  "compliance_checklist": {',
    '    "greeted_properly": true/false, // did rep mention company name "Tez Motors"?',
    '    "offered_test_drive": true/false, // did rep offer a test drive or showroom visit?',
    '    "mentioned_warranty": true/false, // did rep mention warranty option?',
    '    "scheduled_followup": true/false // did rep agree on date/time for next contact?',
    "  },",
    '  "sentiment": "positive" | "neutral" | "negative" | "frustrated",',
    '  "follow_up_draft": "Personalized follow-up message in the customer\'s preferred language (Russian or Uzbek) thanking them and proposing the next action discussed."',
    "}",
    "Note: Mixed Uzbek-Russian language is expected. Translate the summary to clean Russian, but write the follow-up draft in the language preferred by the customer in the transcript.",
    "Output ONLY the raw JSON string. No preamble, no markdown code blocks, no wrapping in ```json."
  ].join(" ");

  const out = await llmText({ system, user: `Call transcript:\n${clean.slice(0, 6000)}`, maxTokens: 800 });

  if (!out) {
    return {
      summary: clean.slice(0, 280),
      leadScore,
      ai: false,
      metadata: {
        extracted_entities: { budget: null, car_model: null, payment_pref: null, urgency: "cold", closing_probability: leadScore, closing_probability_reason: "Вычислено по умолчанию." },
        compliance_checklist: { greeted_properly: false, offered_test_drive: false, mentioned_warranty: false, scheduled_followup: false },
        compliance_score: 0,
        sentiment: "neutral",
        follow_up_draft: `Спасибо за звонок! Мы свяжемся с вами в ближайшее время.`,
      }
    };
  }

  try {
    let cleanedJson = out.replace(/```json|```/g, "").trim();
    // Salvage: if the model wrapped the JSON in any prose, parse just the {...} object.
    const first = cleanedJson.indexOf("{");
    const last = cleanedJson.lastIndexOf("}");
    if (first >= 0 && last > first) cleanedJson = cleanedJson.slice(first, last + 1);
    const data = JSON.parse(cleanedJson);

    const summaryText = normalizeCallSummary(data.summary);

    // Calculate compliance score in JS for predictability
    const checklist = data.compliance_checklist || { greeted_properly: false, offered_test_drive: false, mentioned_warranty: false, scheduled_followup: false };
    let checkCount = 0;
    if (checklist.greeted_properly) checkCount++;
    if (checklist.offered_test_drive) checkCount++;
    if (checklist.mentioned_warranty) checkCount++;
    if (checklist.scheduled_followup) checkCount++;
    const compliance_score = checkCount * 25;

    // Use default probability fallback based on urgency
    let defaultProb = 25;
    const urgency = data.extracted_entities?.urgency || "cold";
    if (urgency === "hot") defaultProb = 85;
    else if (urgency === "warm") defaultProb = 50;
    else defaultProb = 15;

    const parsedClosingProb = typeof data.extracted_entities?.closing_probability === "number"
      ? data.extracted_entities.closing_probability
      : defaultProb;

    return {
      summary: summaryText || clean.slice(0, 280),
      leadScore,
      ai: true,
      metadata: {
        extracted_entities: {
          budget: typeof data.extracted_entities?.budget === "number" ? data.extracted_entities.budget : null,
          car_model: typeof data.extracted_entities?.car_model === "string" ? data.extracted_entities.car_model : null,
          payment_pref: typeof data.extracted_entities?.payment_pref === "string" ? data.extracted_entities.payment_pref : null,
          urgency: ["hot", "warm", "cold"].includes(data.extracted_entities?.urgency) ? data.extracted_entities.urgency : "cold",
          closing_probability: parsedClosingProb,
          closing_probability_reason: typeof data.extracted_entities?.closing_probability_reason === "string"
            ? data.extracted_entities.closing_probability_reason
            : "Автоматическая ИИ-оценка диалога.",
        },
        compliance_checklist: {
          greeted_properly: Boolean(checklist.greeted_properly),
          offered_test_drive: Boolean(checklist.offered_test_drive),
          mentioned_warranty: Boolean(checklist.mentioned_warranty),
          scheduled_followup: Boolean(checklist.scheduled_followup),
        },
        compliance_score,
        sentiment: ["positive", "neutral", "negative", "frustrated"].includes(data.sentiment) ? data.sentiment : "neutral",
        follow_up_draft: data.follow_up_draft || "",
      }
    };
  } catch (err) {
    console.error("Failed to parse LLM call analysis JSON:", err, "Raw response:", out);
    return {
      // Fall back to a readable transcript excerpt — never dump raw (malformed) JSON.
      summary: clean.slice(0, 280),
      leadScore,
      ai: false,
      metadata: {
        extracted_entities: { budget: null, car_model: null, payment_pref: null, urgency: "cold", closing_probability: leadScore, closing_probability_reason: "Ошибка парсинга ответа ИИ." },
        compliance_checklist: { greeted_properly: false, offered_test_drive: false, mentioned_warranty: false, scheduled_followup: false },
        compliance_score: 0,
        sentiment: "neutral",
        follow_up_draft: `Спасибо за звонок! Мы свяжемся с вами в ближайшее время.`,
      }
    };
  }
}
