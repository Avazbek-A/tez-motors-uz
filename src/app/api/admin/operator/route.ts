import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { gatherOperatorContext } from "@/lib/operator-data";
import { generateOperatorBriefing } from "@/lib/operator";

/**
 * AI Operator briefing — gathers the live business context and returns a
 * prioritized daily briefing (LLM-narrated, fail-open to a template). Read-only,
 * admin-gated. ?locale=ru|uz|en.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const locale = new URL(request.url).searchParams.get("locale") || "ru";
  try {
    const supabase = createServiceClient();
    const context = await gatherOperatorContext(supabase);
    const { text, ai } = await generateOperatorBriefing(context, locale);
    return NextResponse.json({ ok: true, briefing: text, ai, context });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to build briefing" }, { status: 500 });
  }
}
