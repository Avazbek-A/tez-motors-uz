import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import { verifyTurnstile } from "@/lib/turnstile";
import { notifyNewInquiry, confirmToCustomer } from "@/lib/notify";

/**
 * Public financing application (Phase AP). Captures an installment request +
 * basic affordability info into financing_applications and alerts the dealer to
 * hand off to a bank/leasing partner. Lead-capture only — no credit decision,
 * no money bound. Hardened: KV rate-limit + Turnstile + honeypot + zod.
 */
const checkRateLimit = createKvRateLimiter({ max: 4, windowMs: 10 * 60 * 1000, prefix: "financing" });

const schema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(5).max(20),
  email: z.string().email().max(200).optional().or(z.literal("")),
  car_id: z.string().uuid().optional().nullable(),
  down_pct: z.number().min(0).max(100).optional().nullable(),
  term_months: z.number().int().min(1).max(120).optional().nullable(),
  estimated_monthly: z.number().min(0).max(1_000_000).optional().nullable(),
  employment: z.string().max(120).optional().nullable(),
  income_band: z.string().max(60).optional().nullable(),
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
    const data = schema.parse(await request.json());
    if (data.website) return NextResponse.json({ success: true }, { status: 201 }); // honeypot

    const ok = await verifyTurnstile(data.turnstile_token, getClientIp(request));
    if (!ok) {
      return NextResponse.json({ success: false, error: "Captcha verification failed" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from("financing_applications").insert({
      customer_name: data.name,
      customer_phone: data.phone,
      car_id: data.car_id ?? null,
      down_pct: data.down_pct ?? null,
      term_months: data.term_months ?? null,
      estimated_monthly: data.estimated_monthly ?? null,
      employment: data.employment ?? null,
      income_band: data.income_band ?? null,
      notes: data.notes ?? null,
      locale: data.locale ?? "ru",
      status: "new",
    });
    if (error) {
      return NextResponse.json({ success: false, error: "Failed to save application" }, { status: 500 });
    }

    const summary = `Financing request${data.term_months ? `: ${data.term_months} mo` : ""}${data.down_pct != null ? `, ${data.down_pct}% down` : ""}${data.estimated_monthly ? `, ~$${Math.round(data.estimated_monthly)}/mo` : ""}`;
    // Reuse the existing 'calculator' inquiry type — no CHECK migration.
    notifyNewInquiry({
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      type: "calculator",
      message: summary,
      source_page: "financing",
      locale: data.locale,
    }).catch(() => {});
    confirmToCustomer({ email: data.email || null, name: data.name, locale: data.locale, type: "calculator" }).catch(() => {});

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
