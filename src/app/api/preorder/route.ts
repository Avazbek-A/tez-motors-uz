/**
 * Public pre-order (made-to-order) intake.
 *
 * The dealer is an importer: most demand is for a configuration that is NOT in
 * stock ("bring me this exact trim/colour, 6–8 weeks"). This route turns a
 * model_catalog entry + a chosen config into BOTH a lead (inquiries row) and a
 * trackable import order (orders row, is_preorder=true) — reusing the existing
 * order timeline, /track lookup, and Payme deposit flow verbatim.
 *
 * Reuses the car_inquiry inquiry type with metadata.preorder=true so no
 * inquiries.type CHECK migration is needed. Hardened like every public POST:
 * KV rate-limit + Turnstile + honeypot + zod. Workers-safe (DB + fetch only).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyNewInquiry, confirmToCustomer } from "@/lib/notify";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import { verifyTurnstile } from "@/lib/turnstile";
import { generateReferenceCode } from "@/lib/order-code";
import { parseAttributionCookie, ATTRIBUTION_COOKIE } from "@/lib/attribution";

const checkRateLimit = createKvRateLimiter({ max: 3, windowMs: 10 * 60 * 1000, prefix: "preorder" });

const schema = z.object({
  model_id: z.string().uuid(),
  name: z.string().min(2).max(100),
  phone: z.string().min(5).max(20),
  email: z.string().email().max(200).optional().or(z.literal("")),
  trim: z.string().max(100).optional().nullable(),
  color: z.string().max(60).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  locale: z.enum(["ru", "uz", "en"]).optional(),
  website: z.string().max(0).optional(), // honeypot
  turnstile_token: z.string().max(4096).optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!(await checkRateLimit(getClientIp(request)))) {
      return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const data = schema.parse(body);

    // Honeypot: a filled `website` field means a bot. Pretend success.
    if (data.website) {
      return NextResponse.json({ success: true }, { status: 201 });
    }

    const ok = await verifyTurnstile(data.turnstile_token, getClientIp(request));
    if (!ok) {
      return NextResponse.json({ success: false, error: "Captcha verification failed" }, { status: 400 });
    }

    // First-touch acquisition attribution → stamped on the order for channel ROI.
    const attribution = parseAttributionCookie(request.cookies.get(ATTRIBUTION_COOKIE)?.value);

    const supabase = createServiceClient();

    const { data: model, error: modelError } = await supabase
      .from("model_catalog")
      .select("id, brand, model, year, base_price_usd, lead_time_weeks_min, lead_time_weeks_max, is_orderable")
      .eq("id", data.model_id)
      .single();

    if (modelError || !model) {
      return NextResponse.json({ success: false, error: "Model not found" }, { status: 404 });
    }
    if (!model.is_orderable) {
      return NextResponse.json({ success: false, error: "Model is not orderable" }, { status: 409 });
    }

    const quotedLeadTime = `${model.lead_time_weeks_min}-${model.lead_time_weeks_max}`;
    const config = {
      trim: data.trim ?? null,
      color: data.color ?? null,
      notes: data.notes ?? null,
    };
    const summary = `Pre-order: ${model.brand} ${model.model}${model.year ? ` ${model.year}` : ""}` +
      `${data.trim ? `, trim: ${data.trim}` : ""}${data.color ? `, color: ${data.color}` : ""}` +
      ` (ETA ${quotedLeadTime} weeks)`;

    const { data: inquiry, error: inquiryError } = await supabase
      .from("inquiries")
      .insert({
        type: "car_inquiry",
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        status: "new",
        source_page: "preorder",
        message: `${summary}${data.notes ? ` — ${data.notes}` : ""}`,
        metadata: {
          preorder: true,
          model_id: model.id,
          config,
          quoted_lead_time_weeks: quotedLeadTime,
          ...(attribution ? { attribution } : {}),
        },
      })
      .select("id")
      .single();

    if (inquiryError || !inquiry) {
      return NextResponse.json({ success: false, error: "Failed to save pre-order" }, { status: 500 });
    }

    // Create the trackable import order. Retry once on a UNIQUE code collision;
    // the inquiry is already saved, so we never fail the request on order error.
    let referenceCode: string | null = null;
    for (let attempt = 0; attempt < 2 && !referenceCode; attempt++) {
      const code = generateReferenceCode();
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          reference_code: code,
          status: "ordered",
          is_preorder: true,
          model_id: model.id,
          config,
          quoted_lead_time_weeks: quotedLeadTime,
          inquiry_id: inquiry.id,
          customer_name: data.name,
          customer_phone: data.phone,
          customer_email: data.email || null,
          locale: data.locale ?? "ru",
          amount_usd: model.base_price_usd ?? null,
          notes: data.notes ?? null,
          attribution: attribution ?? null,
        })
        .select("id")
        .single();

      if (!orderError && order) {
        referenceCode = code;
        await supabase.from("order_events").insert({
          order_id: order.id,
          status: "ordered",
          note: "Pre-order received",
        });
      }
    }

    notifyNewInquiry({
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      type: "car_inquiry",
      message: summary,
      source_page: "preorder",
      locale: data.locale,
      metadata: { preorder: true, config, quoted_lead_time_weeks: quotedLeadTime },
    }).catch(() => {});
    confirmToCustomer({ email: data.email || null, name: data.name, locale: data.locale }).catch(() => {});

    return NextResponse.json({ success: true, reference_code: referenceCode }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
