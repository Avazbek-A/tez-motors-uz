import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, getAdminSessionContext } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { analyzeCall } from "@/lib/call-intel";
import { logAdminAction } from "@/lib/audit";
import { contactKey } from "@/lib/crm";
import { alertDealer } from "@/lib/error-report";
import { generateVoiceSignature, cosineSimilarity } from "@/lib/biometrics";

/**
 * Call log + intelligence (Phase AM). Admin-gated.
 *  GET  — recent calls (optionally ?phone= for one customer's timeline).
 *  POST — log a call; if a transcript is supplied, summarize + lead-score + analyze it.
 * Recordings/transcripts are sensitive PII — service-role only, never public.
 */
const createSchema = z.object({
  customer_phone: z.string().min(3).max(20),
  direction: z.enum(["inbound", "outbound"]).optional(),
  duration_sec: z.number().int().min(0).max(36000).optional().nullable(),
  recording_url: z.string().url().max(2000).optional().nullable(),
  transcript: z.string().max(20000).optional().nullable(),
  // Integrated CRM pipeline fields
  customer_name: z.string().max(100).optional().nullable(),
  pipeline_status: z.enum(["new", "contacted", "in_progress", "closed"]).optional().nullable(),
  follow_up_date: z.string().max(100).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const phone = new URL(request.url).searchParams.get("phone");
  const supabase = createServiceClient();
  let q = supabase
    .from("calls")
    .select("id, customer_phone, direction, duration_sec, summary, lead_score, metadata, created_at")
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

  const {
    customer_phone,
    direction = "inbound",
    duration_sec = null,
    recording_url = null,
    transcript = "",
    customer_name,
    pipeline_status,
    follow_up_date,
    notes,
    assigned_to,
  } = parsed.data;

  // 1. Analyze the transcript if present
  const { summary, leadScore, metadata } = transcript
    ? await analyzeCall(transcript, duration_sec ?? 0)
    : { summary: "", leadScore: 0, metadata: undefined };

  const closingProb = metadata?.extracted_entities?.closing_probability ?? 25;

  const ctx = await getAdminSessionContext(request);
  const currentAdminId = ctx?.user?.id ?? null;
  const targetRepId = assigned_to || currentAdminId;

  const supabase = createServiceClient();

  // Extract biometric voice signature
  let voiceSignature: number[] | null = null;
  if (recording_url && (recording_url.startsWith("http://") || recording_url.startsWith("https://"))) {
    try {
      const res = await fetch(recording_url);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        voiceSignature = generateVoiceSignature(buffer, duration_sec ?? 0, customer_phone);
      }
    } catch (err) {
      console.error("Failed to download recording for biometrics:", err);
    }
  }

  if (!voiceSignature) {
    voiceSignature = generateVoiceSignature(null, duration_sec ?? 0, customer_phone);
  }

  // 2. Insert call log record
  const { data: callLog, error: callError } = await supabase
    .from("calls")
    .insert({
      customer_phone,
      direction,
      duration_sec,
      recording_url,
      transcript: transcript || null,
      summary: summary || null,
      lead_score: leadScore,
      admin_user_id: currentAdminId,
      metadata: metadata || null,
      voice_signature: voiceSignature,
    })
    .select("id, summary, lead_score")
    .single();

  if (callError) {
    return NextResponse.json({ error: callError.message }, { status: 500 });
  }

  // 3. Connect call to the CRM pipeline (inquiries table)
  const phoneCore = contactKey(customer_phone);
  let inquiryId: string | null = null;
  let finalCustomerName = customer_name || `Client (${customer_phone})`;
  let voiceMatchAlert: string | null = null;

  if (phoneCore) {
    // Search for existing inquiry by matching the last 9 digits of phone
    const { data: existingInq } = await supabase
      .from("inquiries")
      .select("id, name, notes, metadata")
      .ilike("phone", `%${phoneCore}%`)
      .limit(1)
      .maybeSingle();

    // Biometric Voice Match Check (Leap 4): find other numbers matching same customer voice print
    const { data: recentVoiceCalls } = await supabase
      .from("calls")
      .select("customer_phone, voice_signature")
      .not("voice_signature", "is", null)
      .not("customer_phone", "ilike", `%${phoneCore}%`)
      .order("created_at", { ascending: false })
      .limit(200);

    const matches: { phone: string; name: string; similarity: number }[] = [];
    if (recentVoiceCalls && recentVoiceCalls.length > 0 && voiceSignature) {
      for (const vc of recentVoiceCalls) {
        if (vc.voice_signature) {
          const sim = cosineSimilarity(voiceSignature, vc.voice_signature);
          if (sim >= 0.95) {
            const cleanDupPhone = contactKey(vc.customer_phone);
            const { data: dupInq } = await supabase
              .from("inquiries")
              .select("name")
              .ilike("phone", `%${cleanDupPhone}%`)
              .limit(1)
              .maybeSingle();

            matches.push({
              phone: vc.customer_phone,
              name: dupInq?.name || "Client",
              similarity: Math.round(sim * 100)
            });
          }
        }
      }
    }

    if (matches.length > 0) {
      const uniqueMatches = Array.from(new Map(matches.map(m => [m.phone, m])).values()).slice(0, 2);
      voiceMatchAlert = `Biometric voice match detected! Voice signature fits duplicate client profiles: ${uniqueMatches.map(m => `${m.name} (${m.phone}) - Match: ${m.similarity}%`).join(", ")}`;
    }

    if (existingInq) {
      inquiryId = existingInq.id;
      if (existingInq.name) {
        finalCustomerName = existingInq.name;
      }

      // Prepare updated notes appending the call details
      let updatedNotes = existingInq.notes || "";
      const dateStr = new Date().toLocaleDateString();
      if (summary) {
        updatedNotes = `${updatedNotes}\n\n[Call Log ${dateStr}]: ${summary}`.trim();
      }
      if (notes) {
        updatedNotes = `${updatedNotes}\n\n[Call Note]: ${notes}`.trim();
      }

      // Merge inquiry metadata to preserve other fields
      const existingMeta = (existingInq.metadata as Record<string, any>) || {};
      const updatedMeta = { ...existingMeta, closing_probability: closingProb };

      // Update the existing inquiry
      const inqUpdate: Record<string, any> = {};
      if (pipeline_status) inqUpdate.status = pipeline_status;
      if (updatedNotes) inqUpdate.notes = updatedNotes;
      if (follow_up_date) inqUpdate.follow_up_date = follow_up_date.slice(0, 10); // format YYYY-MM-DD
      if (targetRepId) inqUpdate.assigned_to = targetRepId;
      inqUpdate.metadata = updatedMeta;

      if (Object.keys(inqUpdate).length > 0) {
        await supabase.from("inquiries").update(inqUpdate).eq("id", existingInq.id);
      }
    } else {
      // Create a new inquiry if none exists
      let initialNotes = `[Created from Call Log]: ${summary || ""}`.trim();
      if (notes) {
        initialNotes = `${initialNotes}\n\n[Call Note]: ${notes}`.trim();
      }

      const { data: newInq } = await supabase
        .from("inquiries")
        .insert({
          name: finalCustomerName,
          phone: customer_phone,
          status: pipeline_status || "contacted",
          type: "callback",
          notes: initialNotes || null,
          follow_up_date: follow_up_date ? follow_up_date.slice(0, 10) : null,
          assigned_to: targetRepId,
          metadata: { closing_probability: closingProb }
        })
        .select("id")
        .single();

      if (newInq) {
        inquiryId = newInq.id;
      }
    }
  }

  // 4. Create follow-up task if follow_up_date is specified
  if (follow_up_date && phoneCore) {
    const dueAt = new Date(follow_up_date);
    if (!isNaN(dueAt.getTime())) {
      await supabase.from("crm_tasks").insert({
        title: `Call Follow-Up with ${finalCustomerName}`,
        kind: "follow_up",
        customer_key: phoneCore,
        customer_phone,
        customer_name: finalCustomerName,
        inquiry_id: inquiryId,
        assigned_to: targetRepId,
        due_at: dueAt.toISOString(),
        status: "open",
        notes: notes || `Scheduled from call logged on ${new Date().toLocaleString()}`,
        created_by: currentAdminId,
      });
    }
  }

  // 5. Fire Compliance or Sentiment alarm if threshold breached
  if (summary && metadata) {
    const hasLowCompliance = metadata.compliance_score < 50;
    const hasBadSentiment = ["negative", "frustrated"].includes(metadata.sentiment);
    if (hasLowCompliance || hasBadSentiment) {
      const reason: string[] = [];
      if (hasLowCompliance) reason.push(`Low compliance score (${metadata.compliance_score}%)`);
      if (hasBadSentiment) reason.push(`Bad customer sentiment (${metadata.sentiment})`);

      void alertDealer(
        `CRM Call Audit Alert`,
        [
          `Client Phone: ${customer_phone}`,
          `Assigned Rep: ${targetRepId || "Unassigned"}`,
          `Trigger: ${reason.join(", ")}`,
          `Summary: ${summary}`,
          `Sentiment: ${metadata.sentiment.toUpperCase()}`,
          `Compliance Score: ${metadata.compliance_score}%`,
          `Greeting Check: ${metadata.compliance_checklist.greeted_properly ? "PASS" : "FAIL"}`,
          `Test Drive Offer: ${metadata.compliance_checklist.offered_test_drive ? "PASS" : "FAIL"}`,
          `Warranty Mentioned: ${metadata.compliance_checklist.mentioned_warranty ? "PASS" : "FAIL"}`,
          `Follow-Up Scheduled: ${metadata.compliance_checklist.scheduled_followup ? "PASS" : "FAIL"}`,
        ],
        { key: `call_audit_alert:${callLog.id}` }
      ).catch(() => {});
    }
  }

  logAdminAction(request, {
    action: "create",
    entity: "call",
    entity_id: callLog.id,
    diff: { phone: customer_phone, lead_score: leadScore },
  }).catch(() => {});

  return NextResponse.json({ success: true, call: callLog, metadata, voiceMatchAlert }, { status: 201 });
}

