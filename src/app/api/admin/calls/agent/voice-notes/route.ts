import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

/**
 * Asynchronous Voice Note Transcribing and Response Generator (Leap 10).
 * Admin-gated.
 * Simulates receiving customer Telegram/WhatsApp voice note transcripts and replying with a voice audio link.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const body = await request.json().catch(() => ({}));
    const { message, language } = body;

    if (!message) {
      return NextResponse.json({ error: "Missing message parameter" }, { status: 400 });
    }

    const reply = language === "uz" 
      ? `Tushundim. So'rovingiz bo'yicha bizda ajoyib takliflar bor. Tez orada batafsil ma'lumot jo'nataman.`
      : `Понял вас. По вашему запросу у нас есть отличные варианты. В ближайшее время отправлю подробности.`;

    return NextResponse.json({
      success: true,
      user_transcript: message,
      ai_response: reply,
      voice_url: "/api/admin/calls/voice-clones?mock=true",
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process voice note" }, { status: 500 });
  }
}
