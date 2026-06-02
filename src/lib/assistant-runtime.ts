/**
 * Stateful assistant turn — the shared "closer" runtime for the Telegram and
 * WhatsApp bots (the web route runs the same steps inline). Wraps the grounded
 * recommendCars with the deterministic sales-agent qualification + conversation
 * memory so all channels behave identically and feed one dealer oversight view
 * (assistant_conversations). Fail-open everywhere: memory/oversight failures
 * never block the reply.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Car } from "@/types/car";
import { recommendCars, historyFromRows } from "./assistant-core";
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
  type SalesStage,
} from "./sales-agent";

export type AssistantChannel = "web" | "telegram" | "whatsapp";

export interface AssistantTurnResult {
  reply: string;
  cars: Car[];
  stage: SalesStage;
  leadScore: number;
  handoff: boolean;
  threadId: string;
}

export async function runAssistantTurn(
  supabase: SupabaseClient,
  opts: {
    channel: AssistantChannel;
    externalKey: string | number;
    message: string;
    locale: string;
    knownPhone?: string | null;
    knownName?: string | null;
  },
): Promise<AssistantTurnResult> {
  const threadId = `${opts.channel}:${opts.externalKey}`;
  const locale = opts.locale === "uz" ? "uz" : opts.locale === "en" ? "en" : "ru";

  // Load prior turns + accumulated profile for this chat (fail-open).
  let history;
  let prevProfile: SalesProfile = {};
  let prevCount = 0;
  try {
    const [{ data: msgs }, { data: convo }] = await Promise.all([
      supabase
        .from("assistant_messages")
        .select("role, content")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true })
        .limit(12),
      supabase
        .from("assistant_conversations")
        .select("profile, message_count")
        .eq("thread_id", threadId)
        .maybeSingle(),
    ]);
    history = historyFromRows(msgs || [], 6);
    if (convo) {
      prevProfile = (convo.profile as SalesProfile) || {};
      prevCount = typeof convo.message_count === "number" ? convo.message_count : 0;
    }
  } catch {
    // no memory — stateless turn
  }

  const slots = extractSlots(opts.message);
  const intent = detectIntent(opts.message);
  const phone = opts.knownPhone || detectPhone(opts.message) || null;
  const name = opts.knownName || detectName(opts.message) || null;
  const profile = mergeProfile(prevProfile, slots);
  const messageCount = prevCount + 1;
  const hasPhone = !!phone;
  const stage = computeStage({ profile, messageCount, intent, hasPhone });
  const leadScore = scoreLead({ profile, intent, hasPhone, messageCount });

  const { reply: baseReply, cars } = await recommendCars(supabase, {
    message: opts.message,
    locale,
    history,
  });
  const nudge = composeNudge(locale, { stage, profile, hasPhone });
  const reply = nudge ? `${baseReply}\n\n${nudge}` : baseReply;

  // Persist turn + conversation state (fail-open).
  try {
    await supabase.from("assistant_messages").insert([
      { thread_id: threadId, role: "user", content: opts.message },
      { thread_id: threadId, role: "assistant", content: reply },
    ]);
  } catch {
    /* ignore */
  }

  const handoff = intent.wantsHuman;
  try {
    await supabase.from("assistant_conversations").upsert(
      {
        thread_id: threadId,
        channel: opts.channel,
        locale,
        profile,
        stage,
        lead_score: leadScore,
        name: name || undefined,
        phone: phone || undefined,
        handoff,
        handoff_reason: handoff ? "wants-human" : null,
        message_count: messageCount,
        last_message_at: new Date().toISOString(),
      },
      { onConflict: "thread_id" },
    );
  } catch {
    /* ignore */
  }

  return { reply, cars, stage, leadScore, handoff, threadId };
}

/** Flag a bot conversation as handed off once its lead is captured (contact
 *  shared). Links the inquiry so the dealer can jump to it. Fail-open. */
export async function markConversationHandoff(
  supabase: SupabaseClient,
  channel: AssistantChannel,
  externalKey: string | number,
  data: { name?: string | null; phone?: string | null; inquiryId?: string | null },
): Promise<void> {
  const threadId = `${channel}:${externalKey}`;
  try {
    await supabase
      .from("assistant_conversations")
      .update({
        handoff: true,
        handoff_reason: "lead-captured",
        stage: "handoff",
        name: data.name || undefined,
        phone: data.phone || undefined,
        inquiry_id: data.inquiryId || undefined,
        last_message_at: new Date().toISOString(),
      })
      .eq("thread_id", threadId);
  } catch {
    /* ignore */
  }
}
