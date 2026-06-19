import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { llmText } from "@/lib/llm";

/**
 * AI Translation helper for blog posts.
 * Translates Russian text to Uzbek or English, preserving markdown structure.
 * Admin-gated.
 */
const schema = z.object({
  text: z.string().min(1),
  targetLocale: z.enum(["uz", "en"]),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Text and a target locale (uz/en) are required", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { text, targetLocale } = parsed.data;
  const lang = targetLocale === "uz" ? "Uzbek (Latin script)" : "English";

  const system =
    `You are an expert automotive copywriter and translator for Tez Motors (car import China→Uzbekistan). ` +
    `Translate the provided Russian text into high-quality, professional, and natural-sounding ${lang}. ` +
    `CRITICAL: Preserve all Markdown styling (headings, lists, bold text, tables), links, and specific car names/terms. ` +
    `Do NOT add any metadata, notes, pleasantries, or introductory sentences. Output ONLY the translated content.`;

  const translated = await llmText({
    system,
    user: text,
    maxTokens: 3000,
    tier: "reason",
  });

  if (!translated) {
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, translated });
}
