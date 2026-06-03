import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { gatherMarketingSignals } from "@/lib/marketing-autopilot-data";
import { buildMarketingSuggestions } from "@/lib/marketing-autopilot";
import { generateMarketingContent } from "@/lib/marketing-content";
import { logAdminAction } from "@/lib/audit";

/**
 * Marketing Autopilot — proposes what's worth posting about right now from the
 * live state of inventory/demand/promos, and (POST) one-click drafts a chosen
 * suggestion into the Content Studio library. Admin-gated, fail-open.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const supabase = createServiceClient();
  const signals = await gatherMarketingSignals(supabase);
  const suggestions = buildMarketingSuggestions(signals);
  return NextResponse.json({ suggestions });
}

const schema = z.object({
  kind: z.enum(["telegram", "instagram", "facebook", "ad", "blog", "promo"]),
  locale: z.enum(["ru", "uz", "en"]),
  car_id: z.string().uuid().optional().nullable(),
  topic: z.string().max(600).optional().nullable(),
  tone: z.string().max(80).optional().nullable(),
  subject: z.string().max(300).optional().nullable(),
});

/** Generate copy for a suggestion and save it as a draft in one step. */
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
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  if (!parsed.data.car_id && !parsed.data.topic) {
    return NextResponse.json({ error: "Provide a car or a topic" }, { status: 400 });
  }

  const supabase = createServiceClient();
  let car = null;
  if (parsed.data.car_id) {
    const { data } = await supabase
      .from("cars")
      .select("brand, model, year, price_usd, body_type, fuel_type")
      .eq("id", parsed.data.car_id)
      .maybeSingle();
    car = data;
  }

  const { text, ai } = await generateMarketingContent(parsed.data.kind, parsed.data.locale, {
    car,
    topic: parsed.data.topic,
    tone: parsed.data.tone,
  });

  const subject = parsed.data.subject || (car ? `${car.brand} ${car.model}${car.year ? ` ${car.year}` : ""}` : parsed.data.topic || null);
  const { data: inserted, error } = await supabase
    .from("content_drafts")
    .insert({ kind: parsed.data.kind, locale: parsed.data.locale, subject, car_id: parsed.data.car_id ?? null, body: text })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAdminAction(request, { action: "create", entity: "content_draft", entity_id: inserted?.id, diff: { source: "autopilot", kind: parsed.data.kind, locale: parsed.data.locale } }).catch(() => {});
  return NextResponse.json({ success: true, id: inserted?.id, text, ai }, { status: 201 });
}
