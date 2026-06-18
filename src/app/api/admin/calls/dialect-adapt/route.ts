import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { llmText } from "@/lib/llm";

/**
 * Regional Accent and Dialect Adaptor (Leap 16).
 * Admin-gated.
 * Converts conversational templates to specific local dialects (Tashkent, Fergana, Samarkand).
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const body = await request.json().catch(() => ({}));
    const { text, region } = body;

    if (!text || !region) {
      return NextResponse.json({ error: "Missing text or region parameters" }, { status: 400 });
    }

    const systemPrompt = [
      `You are a regional dialect adapter for Tez Motors in Uzbekistan.`,
      `Translate and re-phrase the following sentence into the local dialect of "${region}".`,
      `Focus on common greetings, politeness tags, and region-specific vocabulary.`,
      `Keep it short, simple, and natural.`
    ].join(" ");
    
    let adaptedText = "";
    try {
      const res = await llmText({
        system: systemPrompt,
        user: `Adapt: "${text}"`,
        maxTokens: 100,
        tier: "chat"
      });
      adaptedText = res || "";
    } catch (err) {
      console.warn("LLM dialect adaptation failed, falling back to heuristics:", err);
    }

    if (!adaptedText) {
      const isUz = text.toLowerCase().includes("salom") || text.toLowerCase().includes("rahmat") || text.toLowerCase().includes("aka");
      if (region === "Tashkent") {
        adaptedText = isUz ? `Salom, aka! Qaleysiz? ${text} hop bo'ladi, aka.` : `Салом, ака! Калайсиз? ${text} хоп булади.`;
      } else if (region === "Fergana") {
        adaptedText = isUz ? `Assalomu alaykum, yaxshimisiz? ${text} bo'pti, ukam.` : `Ассалому алайкум, яхшимисиз? ${text} бупти, укам.`;
      } else {
        adaptedText = isUz ? `Salom, jo'ra! Baxtlimisiz? ${text} bo'ladi, jo'ra.` : `Салом, жура! Бахтлимисиз? ${text} булади.`;
      }
    }

    return NextResponse.json({
      success: true,
      original_text: text,
      target_region: region,
      adapted_text: adaptedText.trim()
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to adapt dialect" }, { status: 500 });
  }
}
