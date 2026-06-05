import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import { suppress, verifyUnsubscribeToken } from "@/lib/automation/suppression";

/**
 * One-click marketing unsubscribe (Phase AW Leap 1). The contact + a verifiable
 * token (HMAC, in the email footer link) → add to the suppression list so the
 * journey runner + sendToCustomer stop messaging them. POST (not GET) so an
 * email-client prefetch can't accidentally unsubscribe. Rate-limited.
 */
const checkRateLimit = createKvRateLimiter({ max: 20, windowMs: 10 * 60 * 1000, prefix: "unsub" });

const schema = z.object({
  contact: z.string().min(3).max(200),
  token: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  if (!(await checkRateLimit(getClientIp(request)))) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });

  const valid = await verifyUnsubscribeToken(parsed.data.contact, parsed.data.token);
  if (!valid) return NextResponse.json({ ok: false, error: "Invalid or expired link" }, { status: 400 });

  const supabase = createServiceClient();
  await suppress(supabase, parsed.data.contact, "unsubscribe", null);
  return NextResponse.json({ ok: true });
}
