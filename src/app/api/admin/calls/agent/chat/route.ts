import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { llmText } from "@/lib/llm";

const CAR_SPECS: Record<string, { model: string; price: string; range: string; battery: string; drive: string }> = {
  byd_song: { model: "BYD Song Plus DM-i", price: "$24,500 - $28,900", range: "1,050 km (DM-i hybrid)", battery: "18.3 kWh / 26.6 kWh", drive: "FWD / AWD" },
  byd_han: { model: "BYD Han EV", price: "$32,000 - $39,500", range: "610 km / 715 km EV", battery: "72.0 kWh / 85.4 kWh", drive: "AWD / FWD" },
  byd_seagull: { model: "BYD Seagull (Dolphin Mini)", price: "$12,800 - $14,900", range: "305 km / 405 km EV", battery: "30.08 kWh / 38.88 kWh", drive: "FWD" },
  chery_tiggo: { model: "Chery Tiggo 8 Pro Max", price: "$26,000 - $31,500", range: "Gasoline (9.5L / 100km)", battery: "N/A", drive: "AWD" },
  geely_monjaro: { model: "Geely Monjaro 2.0T", price: "$29,900 - $34,800", range: "Gasoline (8.8L / 100km)", battery: "N/A", drive: "AWD" },
};

/**
 * Dynamic Outbound AI Voice Agent Conversational Endpoint (Leap 3).
 * Admin-gated.
 * Generates the next response turn dynamically based on conversation history,
 * target vehicle specs, and language.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const body = await request.json().catch(() => ({}));
    const history = body.history || [];
    const modelKey = body.model || "byd_song";
    const language = body.language || "ru";
    const userMessage = body.user_message || "";

    const spec = CAR_SPECS[modelKey] || CAR_SPECS.byd_song;

    const systemPrompt = [
      `You are "Лия", a friendly, conversational virtual outbound calling assistant for Tez Motors, a premium importer of Chinese cars in Tashkent.`,
      `You are calling a customer who expressed interest in a vehicle.`,
      `Your current conversation targets:`,
      `- Car Model: ${spec.model}`,
      `- Specs Context: Price range is ${spec.price}, range is ${spec.range}, battery is ${spec.battery}, drive is ${spec.drive}.`,
      `- Official Tez Motors Warranty: 5 years or 150,000 km.`,
      `- Language: You MUST reply in ${language === "uz" ? "Uzbek" : "Russian"}.`,
      `Rules:`,
      `- Keep replies extremely short (maximum 20 words) and voice-friendly. No markdown, lists, or headers.`,
      `- Goals: confirm interest in ${spec.model}, pre-qualify client's budget, offer a test drive or showroom visit in Tashkent.`,
      `- If client is ready for a test drive, say that a manager will send the showroom map in Telegram.`,
      `- Keep the conversation flow natural and responsive to what they say.`
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
      "LIYA (Virtual Assistant next short response):"
    ].filter(Boolean).join("\n\n");

    const reply = await llmText({
      system: systemPrompt,
      user: prompt,
      maxTokens: 60,
      tier: "chat" // Fast conversational response
    });

    return NextResponse.json({ reply: (reply || "").trim() });
  } catch (err) {
    console.error("Outbound AI Agent conversational API failed:", err);
    return NextResponse.json({ error: "Failed to generate AI response" }, { status: 500 });
  }
}
