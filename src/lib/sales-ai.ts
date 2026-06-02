/**
 * Proactive AI sales — drafts a personalized first reply to a lead the dealer
 * can review and send in one tap. Grounded + safe: the model is told never to
 * invent prices, specs, or delivery dates (those are quoted by a human). Fully
 * fail-open: with no LLM_API_KEY (or any failure) it returns a localized
 * template so the feature always produces a usable draft.
 */
import { llmText } from "./llm";

export type SalesLocale = "ru" | "uz" | "en";

export interface LeadContext {
  locale?: string | null;
  name?: string | null;
  message?: string | null;
  type?: string | null;
  carName?: string | null;
}

function toLocale(v: string | null | undefined): SalesLocale {
  return v === "uz" || v === "en" ? v : "ru";
}

function systemPrompt(locale: SalesLocale): string {
  const lang = locale === "uz" ? "Uzbek (Latin script)" : locale === "en" ? "English" : "Russian";
  return [
    "You are a sales specialist at Tez Motors, a company that imports cars from China to Uzbekistan turn-key (sourcing, shipping, customs, warranty).",
    `Write the reply in ${lang}.`,
    "Voice: confident, calm, premium concierge — a trusted specialist, not a pushy salesperson. No emoji.",
    "Length: 2–4 short sentences, ready to send on WhatsApp.",
    "Always: greet by name if provided, acknowledge their interest, and propose ONE concrete next step (answer their questions, arrange a quick call, or calculate the all-inclusive price).",
    "Never invent specific prices, specifications, availability, or delivery dates — those are confirmed by a human. Do not promise anything you weren't told.",
    "Sign off as Tez Motors.",
  ].join(" ");
}

function userPrompt(ctx: LeadContext): string {
  return [
    `Lead name: ${ctx.name || "(not given)"}`,
    `Interested in: ${ctx.carName || "(not specified)"}`,
    `Inquiry type: ${ctx.type || "general"}`,
    `Their message: ${ctx.message || "(no message left)"}`,
    "",
    "Draft the reply now.",
  ].join("\n");
}

function template(ctx: LeadContext): string {
  const locale = toLocale(ctx.locale);
  const name = ctx.name?.trim();
  const car = ctx.carName?.trim();
  if (locale === "uz") {
    return `${name ? `Assalomu alaykum, ${name}!` : "Assalomu alaykum!"} Tez Motorsga murojaatingiz uchun rahmat.${car ? ` ${car} bo'yicha` : ""} barcha savollaringizga javob beramiz va «kalit topshirish» narxini hisoblab beramiz. Sizga qachon qo'ng'iroq qilsak qulay bo'ladi? — Tez Motors`;
  }
  if (locale === "en") {
    return `${name ? `Hello, ${name}!` : "Hello!"} Thank you for contacting Tez Motors.${car ? ` Regarding the ${car},` : ""} we'd be glad to answer your questions and calculate the all-inclusive price. When would be a good time for a quick call? — Tez Motors`;
  }
  return `${name ? `Здравствуйте, ${name}!` : "Здравствуйте!"} Спасибо за обращение в Tez Motors.${car ? ` По ${car}` : ""} с радостью ответим на ваши вопросы и рассчитаем стоимость «под ключ». Когда вам удобно созвониться? — Tez Motors`;
}

/**
 * Draft a reply for a lead. Returns the text and whether it was AI-generated
 * (false = templated fallback). Never throws.
 */
export async function draftLeadReply(ctx: LeadContext): Promise<{ text: string; ai: boolean }> {
  const locale = toLocale(ctx.locale);
  const out = await llmText({
    system: systemPrompt(locale),
    user: userPrompt(ctx),
    maxTokens: 300,
  });
  if (out) return { text: out, ai: true };
  return { text: template(ctx), ai: false };
}
