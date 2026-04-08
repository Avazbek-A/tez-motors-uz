import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendTelegramNotification } from "@/lib/telegram";

const callbackSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(5).max(20),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = callbackSchema.parse(body);

    // Send Telegram notification
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
