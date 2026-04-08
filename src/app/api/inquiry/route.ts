import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendTelegramNotification } from "@/lib/telegram";

const inquirySchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(5).max(20),
  email: z.string().email().optional().or(z.literal("")),
  message: z.string().max(2000).optional(),
  type: z.enum(["general", "car_inquiry", "callback", "calculator"]).default("general"),
  car_id: z.string().optional(),
  source_page: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// In-memory store for now (will be replaced with Supabase)
const inquiries: Array<z.infer<typeof inquirySchema> & { id: string; status: string; created_at: string }> = [];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = inquirySchema.parse(body);

    const inquiry = {
      id: crypto.randomUUID(),
      ...data,
      status: "new" as const,
      created_at: new Date().toISOString(),
    };

    inquiries.push(inquiry);

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

export async function GET() {
  // Admin endpoint - returns all inquiries
  return NextResponse.json({ inquiries, total: inquiries.length });
}
