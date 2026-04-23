import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendTelegramNotification } from "@/lib/telegram";
import { requireAdmin } from "@/lib/auth";

// Simple in-memory rate limiting: max 5 submissions per IP per 10 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const window = 10 * 60 * 1000; // 10 minutes
  const maxRequests = 5;

  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + window });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

const inquirySchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(5).max(20),
  email: z.string().email().max(200).optional().or(z.literal("")),
  message: z.string().max(2000).optional(),
  type: z.enum(["general", "car_inquiry", "callback", "calculator"]).default("general"),
  car_id: z.string().regex(/^[a-f0-9-]{1,64}$/i).optional(),
  source_page: z.string().max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).refine(
    (v) => JSON.stringify(v).length <= 4000,
    "metadata too large",
  ).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const data = inquirySchema.parse(body);

    const supabase = await createClient();

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
  const unauth = requireAdmin(request);
  if (unauth) return unauth;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  try {
    const supabase = await createClient();
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
