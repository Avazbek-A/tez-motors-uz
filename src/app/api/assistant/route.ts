import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyNewInquiry, confirmToCustomer } from "@/lib/notify";
import { reportServerError } from "@/lib/error-report";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import { verifyTurnstile } from "@/lib/turnstile";
import { recommendCars, historyFromRows } from "@/lib/assistant-core";

// Chattier than a form, so a looser bucket than /api/inquiry — but still
// capped to keep LLM spend (and abuse) bounded per IP.
const checkRateLimit = createKvRateLimiter({ max: 15, windowMs: 10 * 60 * 1000, prefix: "assistant" });

const assistantSchema = z.object({
  message: z.string().min(2).max(500),
  locale: z.enum(["ru", "uz", "en"]).optional(),
  // Optional contact capture — when present, we create a qualified lead.
  name: z.string().min(2).max(100).refine((s) => !/https?:\/\//i.test(s), "invalid name").optional(),
  phone: z.string().min(5).max(20).optional(),
  email: z.string().email().max(200).optional().or(z.literal("")),
  // Honeypot: must be empty/absent.
  website: z.string().max(0).optional(),
  turnstile_token: z.string().max(4096).optional(),
  // Conversation thread (client-generated) for multi-turn memory.
  thread_id: z.string().min(8).max(64).optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!(await checkRateLimit(getClientIp(request)))) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const data = assistantSchema.parse(body);
    const locale = data.locale || "ru";

    const ok = await verifyTurnstile(data.turnstile_token, getClientIp(request));
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Captcha verification failed" },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // --- Conversation memory: load prior turns for this thread (if any) so a
    // follow-up is answered in context. Fail-open — never blocks a reply.
    const threadId = data.thread_id || crypto.randomUUID();
    let history;
    if (data.thread_id) {
      try {
        const { data: msgs } = await supabase
          .from("assistant_messages")
          .select("role, content")
          .eq("thread_id", data.thread_id)
          .order("created_at", { ascending: true })
          .limit(12);
        history = historyFromRows(msgs || [], 6);
      } catch {
        // no memory available — proceed stateless
      }
    }

    // --- Retrieval + grounded reply (shared with the Telegram bot). The cars and
    // prices the customer sees always come straight from the DB; the reply falls
    // back to a deterministic template if the LLM is unconfigured or fails.
    const { reply, cars: carList, ceiling } = await recommendCars(supabase, {
      message: data.message,
      locale,
      history,
    });

    // Persist this turn so the next message has context. Fail-open.
    try {
      await supabase.from("assistant_messages").insert([
        { thread_id: threadId, role: "user", content: data.message },
        { thread_id: threadId, role: "assistant", content: reply },
      ]);
    } catch {
      // memory storage unavailable (e.g. migration not applied) — ignore
    }

    // --- Qualification: if the visitor left a phone, capture a lead and notify.
    let leadCaptured = false;
    if (data.phone && data.name) {
      const recommended = carList.slice(0, 3).map((c) => ({ id: c.id, slug: c.slug, name: `${c.brand} ${c.model} ${c.year}` }));
      const { data: inquiry, error } = await supabase
        .from("inquiries")
        .insert({
          name: data.name,
          phone: data.phone,
          email: data.email || null,
          message: data.message,
          type: "car_inquiry",
          car_id: carList[0]?.id || null,
          source_page: "ai-assistant",
          metadata: { assistant: true, recommended, budget_ceiling_usd: ceiling ?? undefined },
          status: "new",
        })
        .select("id")
        .single();

      if (!error && inquiry) {
        leadCaptured = true;
        notifyNewInquiry({
          name: data.name,
          phone: data.phone,
          email: data.email || null,
          message: data.message,
          type: "car_inquiry",
          source_page: "ai-assistant",
          metadata: { assistant: true, recommended },
          locale,
        }).catch(() => {});
        confirmToCustomer({ email: data.email || null, name: data.name, locale }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, reply, cars: carList, lead_captured: leadCaptured, thread_id: threadId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.issues }, { status: 400 });
    }
    reportServerError("POST /api/assistant", error).catch(() => {});
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
