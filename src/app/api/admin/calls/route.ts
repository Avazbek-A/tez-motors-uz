import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, getAdminSessionContext } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { analyzeCall } from "@/lib/call-intel";
import { logAdminAction } from "@/lib/audit";

/**
 * Call log + intelligence (Phase AM). Admin-gated.
 *  GET  — recent calls (optionally ?phone= for one customer's timeline).
 *  POST — log a call; if a transcript is supplied, summarize + lead-score it.
 * Recordings/transcripts are sensitive PII — service-role only, never public.
 */
const createSchema = z.object({
  customer_phone: z.string().min(3).max(20),
  direction: z.enum(["inbound", "outbound"]).optional(),
  duration_sec: z.number().int().min(0).max(36000).optional().nullable(),
  recording_url: z.string().url().max(2000).optional().nullable(),
  transcript: z.string().max(20000).optional().nullable(),
});

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const phone = new URL(request.url).searchParams.get("phone");
  const supabase = createServiceClient();
  let q = supabase
    .from("calls")
    .select("id, customer_phone, direction, duration_sec, summary, lead_score, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (phone) {
    const needle = phone.replace(/\D/g, "").slice(-9);
    if (needle.length >= 7) q = q.ilike("customer_phone", `%${needle}%`);
  }
  const { data } = await q;
  return NextResponse.json({ calls: data || [] });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const transcript = parsed.data.transcript || "";
  const { summary, leadScore } = transcript
    ? await analyzeCall(transcript, parsed.data.duration_sec ?? 0)
    : { summary: "", leadScore: 0 };

  const ctx = await getAdminSessionContext(request);
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("calls")
    .insert({
      customer_phone: parsed.data.customer_phone,
      direction: parsed.data.direction ?? "inbound",
      duration_sec: parsed.data.duration_sec ?? null,
      recording_url: parsed.data.recording_url ?? null,
      transcript: transcript || null,
      summary: summary || null,
      lead_score: leadScore,
      admin_user_id: ctx?.user?.id ?? null,
    })
    .select("id, summary, lead_score")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAdminAction(request, { action: "create", entity: "call", entity_id: data.id, diff: { phone: parsed.data.customer_phone, lead_score: leadScore } }).catch(() => {});
  return NextResponse.json({ success: true, call: data }, { status: 201 });
}
