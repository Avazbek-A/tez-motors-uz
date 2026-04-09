import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendTelegramNotification } from "@/lib/telegram";
import { createClient } from "@/lib/supabase/server";

// Simple rate limiter: 3 requests per 5 minutes per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const window = 5 * 60 * 1000;
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) { rateLimitMap.set(ip, { count: 1, resetAt: now + window }); return true; }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

const callbackSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(5).max(20),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const data = callbackSchema.parse(body);

    // Persist to Supabase
    const supabase = await createClient();
    await supabase.from("inquiries").insert({
      name: data.name,
      phone: data.phone,
      type: "callback",
      status: "new",
      source_page: "callback-widget",
    });

    // Fire-and-forget Telegram notification
    sendTelegramNotification({
      name: data.name,
      phone: data.phone,
      type: "callback",
      source_page: "callback-widget",
    }).catch(() => {});

    return NextResponse.json({ success: true }, { status: 201 });
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
