import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { resolveTierChain } from "@/lib/llm-models";
import { llmConfigured } from "@/lib/llm";

export const runtime = "nodejs";

const CAR_SPECS: Record<string, { model: string; price: number; range: string; battery: string; drive: string }> = {
  byd_song: { model: "BYD Song Plus DM-i", price: 26500, range: "1,050 km (DM-i hybrid)", battery: "18.3 kWh / 26.6 kWh", drive: "FWD / AWD" },
  byd_han: { model: "BYD Han EV", price: 35000, range: "610 km / 715 km EV", battery: "72.0 kWh / 85.4 kWh", drive: "AWD / FWD" },
  byd_seagull: { model: "BYD Seagull (Dolphin Mini)", price: 13800, range: "305 km / 405 km EV", battery: "30.08 kWh / 38.88 kWh", drive: "FWD" },
  chery_tiggo: { model: "Chery Tiggo 8 Pro Max", price: 28000, range: "Gasoline (9.5L / 100km)", battery: "N/A", drive: "AWD" },
  geely_monjaro: { model: "Geely Monjaro 2.0T", price: 32000, range: "Gasoline (8.8L / 100km)", battery: "N/A", drive: "AWD" },
};

/**
 * Low-Latency SSE Streaming Conversational Agent Endpoint.
 * Supports multiple agents: qualifier (Лия), scheduler (Алина), closer (Сардор).
 * Analyzes message sentiment and offers dynamic, sentiment-driven discount recommendations.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const body = await request.json().catch(() => ({}));
    // Bound the conversational input — a voice chat shouldn't grow without limit, and
    // this caps the prompt size (cost) regardless of what the client sends. Keep the
    // most recent turns; truncate each. Admin-only, so this is belt-and-suspenders.
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
    
    // Determine suggested discount (up to 5% off standard price)
    let suggestedDiscount: number | null = null;
    let sentiment = "neutral";
    if (isObjection) {
      sentiment = "friction";
      suggestedDiscount = Math.round((spec.price * 0.05) / 100) * 100; // round to nearest 100
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

    // Setup ReadableStream for SSE
    const encoder = new TextEncoder();

    // Check if we should attempt actual LLM streaming
    let stream: ReadableStream | null = null;

    if (llmConfigured()) {
      try {
        const chain = await resolveTierChain("chat");
        if (chain.length > 0) {
          const m = chain[0]; // pick first available provider
          const formattedHistory = history.map((turn: any) => {
            const role = turn.speaker === "AI" ? "assistant" : "user";
            return { role, content: turn.text };
          });

          const res = await fetch(m.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(m.key ? { Authorization: `Bearer ${m.key}` } : {}),
              ...(m.provider === "openrouter" ? { "HTTP-Referer": "https://tezmotors.uz", "X-Title": "Tez Motors" } : {}),
            },
            body: JSON.stringify({
              model: m.model,
              max_tokens: 80,
              temperature: 0.5,
              stream: true,
              messages: [
                { role: "system", content: systemPrompt },
                ...formattedHistory,
                ...(userMessage ? [{ role: "user", content: userMessage }] : []),
              ],
            }),
          });

          if (res.ok && res.body) {
            const responseReader = res.body.getReader();
            const responseDecoder = new TextDecoder();
            let buffer = "";

            stream = new ReadableStream({
              async start(controller) {
                try {
                  // Send initial metadata
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sentiment, suggested_discount: suggestedDiscount })}\n\n`));

                  while (true) {
                    const { done, value } = await responseReader.read();
                    if (done) break;

                    buffer += responseDecoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                      const cleanLine = line.trim();
                      if (!cleanLine) continue;
                      if (cleanLine === "data: [DONE]") continue;

                      if (cleanLine.startsWith("data: ")) {
                        try {
                          const parsed = JSON.parse(cleanLine.substring(6));
                          const textChunk = parsed.choices?.[0]?.delta?.content || "";
                          if (textChunk) {
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: textChunk })}\n\n`));
                          }
                        } catch (e) {
                          // Ignore parsing errors of incomplete lines
                        }
                      }
                    }
                  }
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                } catch (err) {
                  controller.error(err);
                }
              }
            });
          }
        }
      } catch (err) {
        console.error("Error setting up LLM streaming, falling back to mock stream:", err);
      }
    }

    // Fallback stream if actual stream is not available/failed
    if (!stream) {
      stream = new ReadableStream({
        async start(controller) {
          // Send initial metadata
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sentiment, suggested_discount: suggestedDiscount })}\n\n`));

          // Split fallback text into words and stream them with delay
          const words = fallbackText.split(" ");
          for (let i = 0; i < words.length; i++) {
            const chunk = (i > 0 ? " " : "") + words[i];
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
            await new Promise((resolve) => setTimeout(resolve, 80)); // Simulate low latency streaming delay
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      });
    }

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (err: any) {
    console.error("Streaming agent API failed:", err);
    return NextResponse.json({ error: err.message || "Streaming failed" }, { status: 500 });
  }
}
