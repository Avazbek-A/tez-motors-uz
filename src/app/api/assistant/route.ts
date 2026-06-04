import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyNewInquiry, confirmToCustomer } from "@/lib/notify";
import { reportServerError } from "@/lib/error-report";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import { verifyTurnstile } from "@/lib/turnstile";
import { recommendCars, historyFromRows } from "@/lib/assistant-core";
import {
  extractSlots,
  detectPhone,
  detectName,
  detectIntent,
  mergeProfile,
  computeStage,
  scoreLead,
  composeNudge,
  type SalesProfile,
} from "@/lib/sales-agent";

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
  // Conversation thread (client-generated UUID) for multi-turn memory.
  // SECURITY: must be a high-entropy UUID — a loose `min(8).max(64)` lets an
  // attacker guess a short thread_id, then (a) read another buyer's history
  // into the LLM context, (b) contaminate that buyer's `assistant_messages`
  // with injected turns, or (c) clobber the conversation row's `profile` /
  // `stage` / `lead_score`. Pinning to a v4-shaped UUID closes the guessing
  // window — `crypto.randomUUID()` (what the client widgets already emit) is
  // 122 bits of entropy, well past brute-force reach.
  thread_id: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "thread_id must be a UUID",
    )
    .optional(),
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

    // --- Conversation memory: load prior turns + the accumulated qualification
    // profile/stage for this thread (if any). Fail-open — never blocks a reply.
    const threadId = data.thread_id || crypto.randomUUID();
    let history;
    let prevProfile: SalesProfile = {};
    let prevCount = 0;
    if (data.thread_id) {
      try {
        const [{ data: msgs }, { data: convo }] = await Promise.all([
          supabase
            .from("assistant_messages")
            .select("role, content")
            .eq("thread_id", data.thread_id)
            .order("created_at", { ascending: true })
            .limit(12),
          supabase
            .from("assistant_conversations")
            .select("profile, message_count")
            .eq("thread_id", data.thread_id)
            .maybeSingle(),
        ]);
        history = historyFromRows(msgs || [], 6);
        if (convo) {
          prevProfile = (convo.profile as SalesProfile) || {};
          prevCount = typeof convo.message_count === "number" ? convo.message_count : 0;
        }
      } catch {
        // no memory available — proceed stateless
      }
    }

    // --- Sales-agent qualification (deterministic, zero LLM cost): accumulate a
    // buyer profile, detect a phone/intent in free text, score + stage the lead.
    const slots = extractSlots(data.message);
    const intent = detectIntent(data.message);
    const detectedPhone = detectPhone(data.message);
    const phone = data.phone || detectedPhone || null;
    const name = data.name || detectName(data.message) || null;
    const profile = mergeProfile(prevProfile, slots);
    const messageCount = prevCount + 1;
    const hasPhone = !!phone;
    const stage = computeStage({ profile, messageCount, intent, hasPhone });
    const leadScore = scoreLead({ profile, intent, hasPhone, messageCount });

    // --- Retrieval + grounded reply (shared with the Telegram/WhatsApp bots). The
    // cars and prices always come straight from the DB; the reply falls back to a
    // deterministic template if the LLM is unconfigured or fails.
    const { reply: baseReply, cars: carList, ceiling } = await recommendCars(supabase, {
      message: data.message,
      locale,
      history,
    });

    // Append a proactive nudge (ask for a number / offer installments / confirm).
    const nudge = composeNudge(locale, { stage, profile, hasPhone });
    const reply = nudge ? `${baseReply}\n\n${nudge}` : baseReply;

    // Persist this turn so the next message has context. Fail-open.
    try {
      await supabase.from("assistant_messages").insert([
        { thread_id: threadId, role: "user", content: data.message },
        { thread_id: threadId, role: "assistant", content: reply },
      ]);
    } catch {
      // memory storage unavailable (e.g. migration not applied) — ignore
    }

    // --- Lead capture: fire whenever a phone is present (typed in the form OR in
    // free text). Name falls back to a localized placeholder so a hot anonymous
    // buyer who drops only a number still becomes a lead.
    let leadCaptured = false;
    let inquiryId: string | null = null;
    const recommended = carList.slice(0, 3).map((c) => ({ id: c.id, slug: c.slug, name: `${c.brand} ${c.model} ${c.year}` }));
    if (phone) {
      const leadName = name || (locale === "uz" ? "Assistent lidi" : locale === "en" ? "Assistant lead" : "Лид с ассистента");
      const metadata = {
        assistant: true,
        recommended,
        budget_ceiling_usd: ceiling ?? undefined,
        profile,
        lead_score: leadScore,
        stage,
        thread_id: threadId,
      };
      const { data: inquiry, error } = await supabase
        .from("inquiries")
        .insert({
          name: leadName,
          phone,
          email: data.email || null,
          message: data.message,
          type: "car_inquiry",
          car_id: carList[0]?.id || null,
          source_page: "ai-assistant",
          metadata,
          status: "new",
        })
        .select("id")
        .single();

      if (!error && inquiry) {
        leadCaptured = true;
        inquiryId = inquiry.id as string;
        notifyNewInquiry({
          name: leadName,
          phone,
          email: data.email || null,
          message: data.message,
          type: "car_inquiry",
          source_page: "ai-assistant",
          metadata,
          locale,
        }).catch(() => {});
        confirmToCustomer({ email: data.email || null, name: leadName, locale }).catch(() => {});
      }
    }

    // --- Persist the conversation-level state for dealer oversight + handoff.
    const handoff = leadCaptured || intent.wantsHuman;
    const handoffReason = leadCaptured ? "lead-captured" : intent.wantsHuman ? "wants-human" : null;
    try {
      await supabase.from("assistant_conversations").upsert(
        {
          thread_id: threadId,
          channel: "web",
          locale,
          profile,
          stage,
          lead_score: leadScore,
          name: name || undefined,
          phone: phone || undefined,
          email: data.email || undefined,
          handoff,
          handoff_reason: handoffReason,
          inquiry_id: inquiryId || undefined,
          message_count: messageCount,
          last_message_at: new Date().toISOString(),
        },
        { onConflict: "thread_id" },
      );
    } catch {
      // conversation table unavailable (migration not applied) — ignore
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
