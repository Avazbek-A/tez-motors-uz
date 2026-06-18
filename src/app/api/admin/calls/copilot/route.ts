import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { llmText } from "@/lib/llm";

/**
 * Live Sales Copilot Coach (Leap 2). Admin-gated.
 * POST — receives current conversation transcript and returns a live sales tip.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const body = await request.json().catch(() => ({}));
    const transcript = (body?.transcript || "").trim();
    if (!transcript) {
      return NextResponse.json({ suggestion: "" });
    }

    const system = [
      "You are an active live sales coach for Tez Motors, a premium Chinese-car importer in Tashkent.",
      "The sales rep is talking to a client. Based on the current transcript, output a single, highly actionable coaching tip or car spec reminder.",
      "Rules:",
      "- Maximum 15 words.",
      "- Output in Russian or Uzbek, depending on which language was used in the transcript.",
      "- Be concise, direct, and conversational.",
      "- If the customer has concerns or questions, provide an immediate answer or objection-handler.",
      "- Do not use markdown, backticks, or lists."
    ].join(" ");

    // Use the "chat" tier for faster response times (snappy feedback)
    const suggestion = await llmText({
      system,
      user: `Current call transcript:\n${transcript.slice(-3000)}`,
      maxTokens: 50,
      tier: "chat"
    });

    return NextResponse.json({ suggestion: (suggestion || "").trim() });
  } catch (err) {
    console.error("Sales copilot backend failed:", err);
    return NextResponse.json({ error: "Failed to generate copilot suggestion" }, { status: 500 });
  }
}
