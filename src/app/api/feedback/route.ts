import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import { notifyNewInquiry } from "@/lib/notify";

/**
 * NPS-gated feedback (Phase AW — reputation loop). The post-delivery message
 * links here. We ask for a rating FIRST, then GATE:
 *   - promoter (>=4★): create a public review (moderated) → ask them to share,
 *   - detractor (<4★): route the feedback PRIVATELY to the dealer, do NOT push
 *     them toward a public review (reputation management).
 * Hardened: KV rate-limit + honeypot + zod.
 */
const checkRateLimit = createKvRateLimiter({ max: 6, windowMs: 10 * 60 * 1000, prefix: "feedback" });
const PROMOTER_MIN = 4;

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
  name: z.string().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  car_id: z.string().uuid().optional().nullable(),
  car: z.string().max(120).optional().nullable(),
  reference_code: z.string().max(40).optional().nullable(),
  locale: z.enum(["ru", "uz", "en"]).optional(),
  website: z.string().max(0).optional(), // honeypot
});

export async function POST(request: NextRequest) {
  try {
    if (!(await checkRateLimit(getClientIp(request)))) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }
    const data = schema.parse(await request.json());
    if (data.website) return NextResponse.json({ ok: true, action: "public" }); // honeypot

    const supabase = createServiceClient();

    if (data.rating >= PROMOTER_MIN) {
      // Promoter → a public review, held for moderation (never auto-published).
      await supabase.from("reviews").insert({
        client_name: data.name || "Tez Motors customer",
        car_description: data.car || null,
        review_text_ru: data.comment || null,
        rating: data.rating,
        car_id: data.car_id || null,
        is_published: false,
        order_position: 0,
      }).then(() => {}, () => {});
      return NextResponse.json({ ok: true, action: "public" });
    }

    // Detractor → straight to the dealer, privately. No public review.
    notifyNewInquiry({
      name: data.name || "Feedback",
      phone: data.phone || "—",
      type: "callback",
      message: `⚠️ Low rating ${data.rating}/5${data.car ? ` (${data.car})` : ""}${data.reference_code ? ` [${data.reference_code}]` : ""}: ${data.comment || "(no comment)"}`,
      source_page: "feedback",
      locale: data.locale,
    }).catch(() => {});
    return NextResponse.json({ ok: true, action: "private" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
