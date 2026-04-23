import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTelegramNotification } from "@/lib/telegram";
import { requireAdmin } from "@/lib/auth";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

const checkRateLimit = createRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });

const inquirySchema = z.object({
  name: z.string().min(2).max(100).refine((s) => !/https?:\/\//i.test(s), "invalid name"),
  phone: z.string().min(5).max(20),
  email: z.string().email().max(200).optional().or(z.literal("")),
  message: z
    .string()
    .max(2000)
    .refine((s) => (s.match(/https?:\/\//gi) || []).length <= 2, "too many links")
    .optional(),
  type: z.enum(["general", "car_inquiry", "callback", "calculator", "reservation", "test_drive", "trade_in", "newsletter", "price_drop", "service", "part_inquiry"]).default("general"),
  car_id: z.string().regex(/^[a-f0-9-]{1,64}$/i).optional(),
  source_page: z.string().max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).refine(
    (v) => JSON.stringify(v).length <= 4000,
    "metadata too large",
  ).optional(),
  // Honeypot: real clients don't render or fill this. Must be empty/absent.
  website: z.string().max(0).optional(),
  turnstile_token: z.string().max(4096).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    if (!checkRateLimit(getClientIp(request))) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const data = inquirySchema.parse(body);

    const ok = await verifyTurnstile(data.turnstile_token, getClientIp(request));
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Captcha verification failed" },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    const { data: inquiry, error } = await supabase
      .from("inquiries")
      .insert({
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        message: data.message || null,
        type: data.type,
        car_id: data.car_id || null,
        source_page: data.source_page || null,
        metadata: data.metadata || {},
        status: "new",
      })
      .select()
      .single();

    if (error) {
      console.error("Inquiry insert error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to save inquiry" },
        { status: 500 }
      );
    }

    // Send Telegram notification (fire-and-forget)
    sendTelegramNotification({
      name: data.name,
      phone: data.phone,
      message: data.message,
      type: data.type,
      source_page: data.source_page,
      metadata: data.metadata,
    }).catch(() => {});

    return NextResponse.json({ success: true, id: inquiry.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, errors: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  try {
    const supabase = createServiceClient();
    let query = supabase.from("inquiries").select("*").order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data: inquiries, error } = await query;

    if (error) {
      console.error("Inquiry fetch error:", error);
      return NextResponse.json({ inquiries: [], total: 0 }, { status: 500 });
    }

    return NextResponse.json({ inquiries: inquiries || [], total: inquiries?.length || 0 });
  } catch {
    return NextResponse.json({ inquiries: [], total: 0, error: "Internal server error" }, { status: 500 });
  }
}
