import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { generateMarketingContent, CONTENT_KINDS } from "@/lib/marketing-content";

/** Generate marketing content (social/ad/blog/promo), optionally grounded on a
 *  car from inventory. Admin-gated. Fail-open to a template without an LLM key. */
const schema = z.object({
  kind: z.enum(["telegram", "instagram", "facebook", "ad", "blog", "promo"]),
  locale: z.enum(["ru", "uz", "en"]),
  car_id: z.string().uuid().optional().nullable(),
  topic: z.string().max(400).optional().nullable(),
  tone: z.string().max(60).optional().nullable(),
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

  return NextResponse.json({ text, ai, kind: parsed.data.kind, label: CONTENT_KINDS.find((k) => k.key === parsed.data.kind)?.label });
}
