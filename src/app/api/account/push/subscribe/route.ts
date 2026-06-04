import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { getCustomerContext } from "@/lib/customer-auth";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";

// A push subscription can be anonymous (customer_id null) or, more usefully,
// linked to a logged-in customer so price-drop / order-status pushes can target
// them. We attach the customer when a session is present.
//
// Rate-limited (KV) because anonymous subscriptions are accepted: without a cap
// an attacker can spam distinct endpoint URLs to bloat push_subscriptions. A
// real user clicks "allow notifications" at most a couple of times.
const checkRateLimit = createKvRateLimiter({ max: 10, windowMs: 10 * 60 * 1000, prefix: "push-sub" });
const subscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
  locale: z.enum(["ru", "uz", "en"]).optional(),
});

export async function POST(request: NextRequest) {
  if (!(await checkRateLimit(getClientIp(request)))) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid subscription" }, { status: 400 });
  }

  const ctx = await getCustomerContext(request);
  const supabase = createServiceClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      customer_id: ctx?.customer.id ?? null,
      locale: parsed.data.locale ?? ctx?.customer.locale ?? "ru",
    },
    { onConflict: "endpoint" },
  );

  if (error) return NextResponse.json({ success: false }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE — unsubscribe by endpoint (sent in the JSON body).
export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (typeof endpoint !== "string" || !endpoint) {
    return NextResponse.json({ success: false, error: "Missing endpoint" }, { status: 400 });
  }
  const supabase = createServiceClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ success: true });
}
