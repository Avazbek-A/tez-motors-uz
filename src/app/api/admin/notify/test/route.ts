import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sendTelegramNotification } from "@/lib/telegram";
import { sendEmail } from "@/lib/email";

/**
 * Fire a real test notification to the dealer on each configured channel so they
 * can confirm Telegram lead-alerts and email actually arrive. Admin-gated,
 * fail-open: returns per-channel { configured, ok } and never throws.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const tg = await sendTelegramNotification({
    name: "Tez Motors",
    phone: "—",
    type: "test",
    message: "✅ Test alert from the admin Setup page. If you see this, Telegram lead alerts work.",
  });

  const emailConfigured = !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.DEALER_EMAIL);
  let emailOk = false;
  if (emailConfigured) {
    const r = await sendEmail({
      to: process.env.DEALER_EMAIL as string,
      subject: "Tez Motors — email channel test",
      html: "<p>✅ This is a test from your admin Setup page. If you received it, dealer email alerts work.</p>",
    });
    emailOk = r.ok;
  }

  return NextResponse.json({
    telegram: { configured: tg.configured, ok: tg.ok },
    email: { configured: emailConfigured, ok: emailOk },
  });
}
