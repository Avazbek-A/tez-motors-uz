import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { llmText } from "@/lib/llm";

const CAR_SPECS: Record<string, { model: string; price: number; range: string; battery: string; drive: string }> = {
  byd_song: { model: "BYD Song Plus DM-i", price: 26500, range: "1,050 km (DM-i hybrid)", battery: "18.3 kWh / 26.6 kWh", drive: "FWD / AWD" },
  byd_han: { model: "BYD Han EV", price: 35000, range: "610 km / 715 km EV", battery: "72.0 kWh / 85.4 kWh", drive: "AWD / FWD" },
  byd_seagull: { model: "BYD Seagull (Dolphin Mini)", price: 13800, range: "305 km / 405 km EV", battery: "30.08 kWh / 38.88 kWh", drive: "FWD" },
  chery_tiggo: { model: "Chery Tiggo 8 Pro Max", price: 28000, range: "Gasoline (9.5L / 100km)", battery: "N/A", drive: "AWD" },
  geely_monjaro: { model: "Geely Monjaro 2.0T", price: 32000, range: "Gasoline (8.8L / 100km)", battery: "N/A", drive: "AWD" },
};

/**
 * Dynamic Outbound AI Voice Agent Conversational Endpoint (Leap 3 / Upgrades).
 * Admin-gated.
 * Generates the next response turn dynamically based on conversation history,
 * agent preset (qualifier, scheduler, closer), sentiment pricing triggers, and language.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const body = await request.json().catch(() => ({}));
    // Bound conversational input: keep the most recent turns, truncate each, and cap
    // the user message — caps prompt size/cost regardless of client. Admin-only.
    const rawHistory = Array.isArray(body.history) ? body.history : [];
    const history = rawHistory.slice(-20).map((t: any) => ({
      speaker: t?.speaker === "AI" ? "AI" : "Client",
      text: String(t?.text ?? "").slice(0, 2000),
    }));
    const modelKey = body.model || "byd_song";
    const language = body.language === "uz" ? "uz" : "ru";
    const userMessage = String(body.user_message || "").slice(0, 2000);
    const agentType = ["qualifier", "scheduler", "closer"].includes(body.agent_type) ? body.agent_type : "qualifier";

    const spec = CAR_SPECS[modelKey] || CAR_SPECS.byd_song;
    const formattedPrice = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(spec.price);

    // Basic sentiment & pricing objection scan
    const messageLower = userMessage.toLowerCase();
    const isObjection = messageLower.includes("дорого") || messageLower.includes("скидка") || messageLower.includes("дороже") || messageLower.includes("дешевле") || messageLower.includes("expensive") || messageLower.includes("discount") || messageLower.includes("arzon") || messageLower.includes("skidka");
    
    let suggestedDiscount: number | null = null;
    let sentiment = "neutral";
    if (isObjection) {
      sentiment = "friction";
      suggestedDiscount = Math.round((spec.price * 0.05) / 100) * 100; // 5% discount
    } else if (messageLower.includes("хочу") || messageLower.includes("купить") || messageLower.includes("нравится") || messageLower.includes("love") || messageLower.includes("buy") || messageLower.includes("olaman")) {
      sentiment = "positive";
    }

    // Set up agent parameters
    let agentName = "Лия";
    let agentRolePrompt = "";
    let fallbackText = "";

    if (agentType === "scheduler") {
      agentName = "Алина";
      agentRolePrompt = `You are "Алина", the professional scheduling assistant for Tez Motors. Your sole job is to book a test drive or showroom visit in Tashkent. Coordinate with the client on date/time.`;
      fallbackText = language === "uz"
        ? `Ajoyib! Bizda ertaga soat 10:00 yoki 14:00 da test-drayv uchun bo'sh joylar bor. Sizga qaysi vaqt ma'qulroq?`
        : `Отлично! У нас есть свободные слоты на завтра в 10:00 или 14:00 для тест-драйва в Ташкенте. Какое время вам больше подходит?`;
    } else if (agentType === "closer") {
      agentName = "Сардор";
      agentRolePrompt = `You are "Сардор", the senior sales closer and negotiator for Tez Motors. Your job is to close the deal, handle pricing inquiries, and outline purchasing terms.`;
      if (suggestedDiscount) {
        agentRolePrompt += ` Since the customer has a price objection/hesitation, you are authorized to offer a dynamic discount of up to ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(suggestedDiscount)} off the price of ${formattedPrice}. Present this discount professionally to seal the deal.`;
        fallbackText = language === "uz"
          ? `Tushunaman, narx muhim masala. Sizga maxsus taklif sifatida ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(suggestedDiscount)} chegirma qila olamiz, agar bugun band qilsangiz.`
          : `Понимаю, что цена имеет значение. В качестве специального предложения только сегодня мы можем предложить вам персональную скидку в ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(suggestedDiscount)} на ${spec.model}.`;
      } else {
        fallbackText = language === "uz"
          ? `Ushbu model ${formattedPrice} narxda taklif qilinmoqda. Kafolat muddati 5 yil. Rasmiylashtirishni boshlaymizmi?`
          : `Этот автомобиль доступен по цене ${formattedPrice} с официальной гарантией 5 лет. Оформляем бронирование?`;
      }
    } else {
      // default: qualifier / Лия
      agentName = "Лия";
      agentRolePrompt = `You are "Лия", a friendly, warm virtual outbound calling assistant for Tez Motors. Your job is to pre-qualify the client, check their interest in ${spec.model}, and ask if they are looking for EV or hybrid.`;
      fallbackText = language === "uz"
        ? `Salom! Siz Tez Motors-dan ${spec.model} modeliga qiziqqan ekansiz. Bu model hozirda juda ommabop. Test-drayv yozilishni xohlaysizmi?`
        : `Здравствуйте! Вы интересовались моделью ${spec.model} в Tez Motors. Это отличный выбор с запасом хода ${spec.range}. Хотели бы записаться на тест-драйв?`;
    }

    const systemPrompt = [
      agentRolePrompt,
      `Tez Motors is a premium importer of Chinese cars in Tashkent.`,
      `Target Car Specs: Model is ${spec.model}, price is ${formattedPrice}, range is ${spec.range}, battery is ${spec.battery}, drive is ${spec.drive}.`,
      `Tez Motors Official Warranty: 5 years or 150,000 km.`,
      `Language: You MUST respond in ${language === "uz" ? "Uzbek" : "Russian"} only.`,
      `Rules:`,
      `- Keep replies extremely short (maximum 20 words) and voice-friendly. No markdown, lists, or headers.`,
      `- Do not use asterisks or any formatting that cannot be spoken.`,
      `- If customer is ready for next steps, coordinate and guide them to it.`
    ].join(" ");

    // Format chat history for LLM
    const formattedHistory = history.map((turn: any) => {
      const role = turn.speaker === "AI" ? "assistant" : "user";
      return `${role.toUpperCase()}: ${turn.text}`;
    }).join("\n");

    const prompt = [
      "Here is the dialogue history so far:",
      formattedHistory,
      userMessage ? `USER: ${userMessage}` : "",
      `${agentName.toUpperCase()} (Next short response):`
    ].filter(Boolean).join("\n\n");

    let reply = await llmText({
      system: systemPrompt,
      user: prompt,
      maxTokens: 60,
      tier: "chat" // Fast conversational response
    });

    if (!reply) {
      reply = fallbackText;
    }

    return NextResponse.json({
      reply: reply.trim(),
      sentiment,
      suggested_discount: suggestedDiscount
    });
  } catch (err) {
    console.error("Outbound AI Agent conversational API failed:", err);
    return NextResponse.json({ error: "Failed to generate AI response" }, { status: 500 });
  }
}
