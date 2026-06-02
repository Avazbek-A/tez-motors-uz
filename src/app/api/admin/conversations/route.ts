import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { profileSummary, type SalesProfile } from "@/lib/sales-agent";

/**
 * AI sales-agent oversight. Lists live conversations (hot/handoff first) so the
 * dealer can see what the assistant is working and take over the warm ones.
 * With ?thread_id, returns one conversation + its full transcript.
 * Read-only, admin-gated, service-role.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const threadId = new URL(request.url).searchParams.get("thread_id");
  const supabase = createServiceClient();

  if (threadId) {
    const [{ data: convo }, { data: msgs }] = await Promise.all([
      supabase.from("assistant_conversations").select("*").eq("thread_id", threadId).maybeSingle(),
      supabase
        .from("assistant_messages")
        .select("role, content, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true })
        .limit(100),
    ]);
    if (!convo) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      conversation: { ...convo, profile_summary: profileSummary((convo.profile as SalesProfile) || {}) },
      messages: msgs || [],
    });
  }

  const { data, error } = await supabase
    .from("assistant_conversations")
    .select("thread_id, channel, locale, profile, stage, lead_score, name, phone, handoff, handoff_reason, inquiry_id, message_count, last_message_at")
    .order("handoff", { ascending: false })
    .order("lead_score", { ascending: false })
    .order("last_message_at", { ascending: false })
    .limit(150);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []).map((c) => ({
    ...c,
    profile_summary: profileSummary((c.profile as SalesProfile) || {}),
  }));
  return NextResponse.json({ conversations: rows });
}
