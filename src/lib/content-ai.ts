/**
 * AI content generation — listing descriptions and blog drafts. Removes the
 * dealer's biggest writing grind. Grounded on the facts passed in (never
 * invents specs/prices) and fail-open: with no LLM_API_KEY (or any failure) it
 * returns a clean templated fallback so content always gets produced.
 */
import { llmText } from "./llm";

export interface CarFacts {
  brand: string;
  model: string;
  year?: number | null;
  body_type?: string | null;
  fuel_type?: string | null;
  transmission?: string | null;
  engine_volume?: number | null;
  engine_power?: number | null;
  color?: string | null;
}

export interface CarCopy {
  description_ru: string;
  description_uz: string;
  description_en: string;
  ai: boolean;
}

function factsLine(f: CarFacts): string {
  const bits = [
    f.year ? `${f.year}` : "",
    f.body_type || "",
    f.fuel_type || "",
    f.engine_volume ? `${f.engine_volume}L` : "",
    f.engine_power ? `${f.engine_power} hp` : "",
    f.transmission || "",
    f.color || "",
  ].filter(Boolean);
  return bits.join(", ");
}

function templateCopy(f: CarFacts): CarCopy {
  const name = `${f.brand} ${f.model}${f.year ? ` ${f.year}` : ""}`;
  const specs = factsLine(f);
  return {
    description_ru: `${name}${specs ? ` — ${specs}.` : "."} Импорт «под ключ» от Tez Motors: подбор, доставка из Китая, таможня и гарантия. Свяжитесь с нами для расчёта стоимости.`,
    description_uz: `${name}${specs ? ` — ${specs}.` : "."} Tez Motors'dan «kalit topshirish» importi: tanlov, Xitoydan yetkazib berish, bojxona va kafolat. Narxni hisoblash uchun biz bilan bog'laning.`,
    description_en: `${name}${specs ? ` — ${specs}.` : "."} Turn-key import by Tez Motors: sourcing, shipping from China, customs, and warranty. Contact us for an all-inclusive quote.`,
    ai: false,
  };
}

export async function generateCarCopy(f: CarFacts): Promise<CarCopy> {
  const system =
    "You write car listing descriptions for Tez Motors, which imports cars from China to Uzbekistan turn-key. " +
    "Return STRICT JSON only: {\"ru\":\"...\",\"uz\":\"...\",\"en\":\"...\"}. " +
    "Each value is 2-3 sentences, confident and premium (no emoji, no hype). " +
    "uz is Uzbek in Latin script. Use only the facts given — never invent specs, prices, or delivery dates. " +
    "Mention the turn-key import (sourcing, shipping, customs, warranty) once.";
  const user = `Car: ${f.brand} ${f.model}\nFacts: ${factsLine(f) || "(none beyond make/model)"}`;
  const out = await llmText({ system, user, maxTokens: 700 });
  if (out) {
    try {
      const jsonStart = out.indexOf("{");
      const jsonEnd = out.lastIndexOf("}");
      const parsed = JSON.parse(out.slice(jsonStart, jsonEnd + 1)) as { ru?: string; uz?: string; en?: string };
      if (parsed.ru && parsed.uz && parsed.en) {
        return { description_ru: parsed.ru, description_uz: parsed.uz, description_en: parsed.en, ai: true };
      }
    } catch {
      // fall through to template
    }
  }
  return templateCopy(f);
}

export interface BlogDraft {
  title: string;
  content: string;
  ai: boolean;
}

export async function generateBlogDraft(topic: string, locale: "ru" | "uz" | "en" = "ru"): Promise<BlogDraft> {
  const lang = locale === "uz" ? "Uzbek (Latin)" : locale === "en" ? "English" : "Russian";
  const system =
    `You are a content writer for Tez Motors (car import China→Uzbekistan). Write in ${lang}. ` +
    "Return STRICT JSON only: {\"title\":\"...\",\"content\":\"...\"}. " +
    "content is 400-600 words of helpful, accurate editorial (markdown paragraphs, no emoji). " +
    "Be practical and trustworthy; do not invent specific prices or legal claims.";
  const out = await llmText({ system, user: `Topic: ${topic}`, maxTokens: 1400 });
  if (out) {
    try {
      const parsed = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)) as { title?: string; content?: string };
      if (parsed.title && parsed.content) return { title: parsed.title, content: parsed.content, ai: true };
    } catch {
      // fall through
    }
  }
  return {
    title: topic,
    content: `Draft for "${topic}". (AI generation is unavailable — set LLM_API_KEY to enable. Edit this draft before publishing.)`,
    ai: false,
  };
}
