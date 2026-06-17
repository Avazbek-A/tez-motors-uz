/**
 * AI auto-reply for lead-FORM submissions (not chat). When a customer submits the
 * "Оставить заявку" form with a question, we generate an instant grounded answer
 * (free OpenRouter models via llmText → falls open to null if the LLM is down, so
 * the form just shows its normal thank-you). Same anti-hallucination contract as
 * the chat assistant: never invents prices/specs/promises.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { llmText } from "@/lib/llm";
import { detectMessageLocale } from "@/lib/detect-locale";

const LOCALE_NAME: Record<string, string> = { ru: "Russian", uz: "Uzbek (Latin script)", en: "English" };

// Forms with no real question to answer — skip the LLM call entirely.
const SKIP_TYPES = new Set(["newsletter", "callback", "price_drop"]);

export async function generateInquiryReply(
  supabase: SupabaseClient,
  args: { name: string; message?: string | null; locale?: string; carId?: string | null; type: string },
): Promise<string | null> {
  const message = (args.message || "").trim();
  if (message.length < 5 || SKIP_TYPES.has(args.type)) return null;

  // Reply in the language the customer WROTE the form in, falling back to the
  // page locale, then RU — so a Russian message on the UZ site still gets RU.
  const replyLocale = detectMessageLocale(message) || args.locale || "ru";
  const lang = LOCALE_NAME[replyLocale] || "Russian";

  // Ground in the specific car when the lead references one.
  let carCtx = "";
  if (args.carId) {
    const { data: car } = await supabase
      .from("cars")
      .select("brand, model, year, price_usd, body_type, fuel_type, mileage, listing_type")
      .eq("id", args.carId)
      .maybeSingle();
    if (car) {
      carCtx = `The customer is asking about this specific car: ${car.brand} ${car.model} ${car.year}` +
        `${car.price_usd ? ` — $${car.price_usd}` : ""}, ${car.body_type}, ${car.fuel_type}` +
        `${car.listing_type === "used" && car.mileage ? `, ${car.mileage} km` : ""}. Reference it naturally.`;
    }
  }

  const system = [
    "You are the customer-service assistant for Tez Motors, which imports Chinese cars (BYD, Chery, Haval, Geely, Changan, and more) into Uzbekistan.",
    `Reply in ${lang}. If the customer's message is clearly in a different language, reply in THEIR language instead. Exactly 2-3 warm, concrete sentences. No markdown, no bullet lists, no greeting line — answer directly.`,
    "A customer just submitted a contact form with a question. Answer it helpfully and honestly.",
    "NEVER invent a price, spec, delivery time, or financing term. If you don't know a precise figure, say the manager will confirm it.",
    carCtx,
    `End by reassuring ${args.name.slice(0, 60)} that a manager will call them shortly on the number they left.`,
  ].filter(Boolean).join(" ");

  const user = `Customer: ${args.name.slice(0, 60)}. Their message: "${message.slice(0, 1000)}"`;

  // Fail-open: llmText returns null if the free-model chain is exhausted.
  return llmText({ system, user, maxTokens: 320, tier: "chat" });
}
