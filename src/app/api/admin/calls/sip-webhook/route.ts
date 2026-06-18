import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { analyzeCall } from "@/lib/call-intel";
import { generateVoiceSignature } from "@/lib/biometrics";
import { contactKey } from "@/lib/crm";
import { alertDealer } from "@/lib/error-report";
import { timingSafeEqual } from "@/lib/timing-safe";

/**
 * Cloud PBX SIP Webhook API (Leap 1). Called by the external PBX, not an admin,
 * so it can't use the admin session — it's gated by a shared secret instead.
 *
 * SECURITY: fail CLOSED in production. The PBX must send X-SIP-Token matching
 * SIP_WEBHOOK_SECRET. If the secret is unset, the open "mock mode" is allowed
 * ONLY in development — never in prod, where an open endpoint would let anyone
 * enumerate leads by phone, read assigned-manager emails, write rows, and spam
 * the dealer alert. Comparison is timing-safe (matches MARKET_INGEST / payme).
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("X-SIP-Token") || "";
    const secret = process.env.SIP_WEBHOOK_SECRET;
    if (secret) {
      if (!timingSafeEqual(authHeader, secret)) {
        return NextResponse.json({ error: "Unauthorized SIP event" }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === "production") {
      // No secret configured + prod → refuse rather than run open.
      return NextResponse.json({ error: "SIP webhook not configured" }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const event = body.event;
    const callerPhone = body.caller_phone || "";
    const callId = body.call_id || "";

    if (!callerPhone) {
      return NextResponse.json({ error: "Missing caller_phone parameter" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const phoneCore = contactKey(callerPhone);

    // ==========================================
    // EVENT 1: call_started (Dynamic Call Routing)
    // ==========================================
    if (event === "call_started") {
      if (!phoneCore) {
        return NextResponse.json({
          route_to: "ai_assistant",
          reason: "Invalid phone number format, routing to virtual assistant IVR"
        });
      }

      // Query inquiries to check if client has an assigned rep
      const { data: inquiry } = await supabase
        .from("inquiries")
        .select("id, assigned_to, name, status")
        .ilike("phone", `%${phoneCore}%`)
        .not("status", "eq", "closed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (inquiry && inquiry.assigned_to) {
        // Look up assigned manager details
        const { data: admin } = await supabase
          .from("admin_users")
          .select("id, email")
          .eq("id", inquiry.assigned_to)
          .maybeSingle();

        if (admin) {
          return NextResponse.json({
            route_to: "agent",
            agent_id: admin.id,
            sip_destination: admin.email.split("@")[0], // Use email username as SIP extension/endpoint
            client_name: inquiry.name,
            reason: `Routed to assigned rep: ${admin.email}`
          });
        }
      }

      // No active rep found -> route to AI voice assistant IVR
      return NextResponse.json({
        route_to: "ai_assistant",
        sip_destination: "ai-voice-agent-ivr",
        reason: "No active human representative assigned, routing to AI Agent"
      });
    }

    // ==========================================
    // EVENT 2: recording_ready (Automated Lead Sync)
    // ==========================================
    if (event === "recording_ready") {
      const recordingUrl = body.recording_url || "";
      const transcript = body.transcript || "";
      const durationSec = Number(body.duration_sec) || 0;

      // 1. Run LLM transcript analysis
      const analysis = await analyzeCall(transcript, durationSec);
      
      // 2. Fetch the audio file binary if url is present to extract biometric fingerprint
      let voiceSignature: number[] | null = null;
      if (recordingUrl && (recordingUrl.startsWith("http://") || recordingUrl.startsWith("https://"))) {
        try {
          const res = await fetch(recordingUrl);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            voiceSignature = generateVoiceSignature(buffer, durationSec, callerPhone);
          }
        } catch (err) {
          console.error("Failed to download SIP call recording for biometrics:", err);
        }
      }

      // Fallback voice signature if buffer download was skipped or failed
      if (!voiceSignature) {
        voiceSignature = generateVoiceSignature(null, durationSec, callerPhone);
      }

      // 3. Log Call
      const { data: callLog, error: callError } = await supabase
        .from("calls")
        .insert({
          customer_phone: callerPhone,
          direction: body.direction || "inbound",
          duration_sec: durationSec,
          recording_url: recordingUrl || null,
          transcript: transcript || null,
          summary: analysis.summary || null,
          lead_score: analysis.leadScore,
          metadata: analysis.metadata || null,
          voice_signature: voiceSignature,
        })
        .select("id")
        .single();

      if (callError) {
        throw new Error(`Failed to log call: ${callError.message}`);
      }

      // 4. Update CRM Inquiry
      if (phoneCore) {
        const { data: existingInq } = await supabase
          .from("inquiries")
          .select("id, name, notes, metadata")
          .ilike("phone", `%${phoneCore}%`)
          .limit(1)
          .maybeSingle();

        const closingProb = analysis.metadata?.extracted_entities?.closing_probability || 25;

        if (existingInq) {
          let updatedNotes = existingInq.notes || "";
          const dateStr = new Date().toLocaleDateString();
          if (analysis.summary) {
            updatedNotes = `${updatedNotes}\n\n[SIP Call Log ${dateStr}]: ${analysis.summary}`.trim();
          }

          const existingMeta = (existingInq.metadata as Record<string, any>) || {};
          const updatedMeta = { ...existingMeta, closing_probability: closingProb };

          await supabase
            .from("inquiries")
            .update({
              notes: updatedNotes,
              metadata: updatedMeta
            })
            .eq("id", existingInq.id);
        } else {
          // Create new inquiry for cold caller
          await supabase.from("inquiries").insert({
            name: `SIP Caller (${callerPhone})`,
            phone: callerPhone,
            status: "new",
            type: "callback",
            notes: `[Auto Created from SIP Call]: ${analysis.summary || ""}`.trim(),
            metadata: { closing_probability: closingProb }
          });
        }
      }

      // 5. Fire Telegram error alerts for low compliance/frustrated customer
      if (analysis.metadata) {
        const isLowCompliance = analysis.metadata.compliance_score < 50;
        const isFrustrated = ["negative", "frustrated"].includes(analysis.metadata.sentiment);
        
        if (isLowCompliance || isFrustrated) {
          const triggers = [];
          if (isLowCompliance) triggers.push(`Low compliance (${analysis.metadata.compliance_score}%)`);
          if (isFrustrated) triggers.push(`Negative sentiment (${analysis.metadata.sentiment})`);

          await alertDealer(
            `SIP Call Audit Warning`,
            [
              `Call ID: ${callId}`,
              `Phone: ${callerPhone}`,
              `Trigger: ${triggers.join(", ")}`,
              `Summary: ${analysis.summary}`,
              `Sentiment: ${analysis.metadata.sentiment.toUpperCase()}`,
              `Compliance Score: ${analysis.metadata.compliance_score}%`,
            ],
            { key: `sip_call_audit_alert:${callLog.id}` }
          ).catch(() => {});
        }
      }

      return NextResponse.json({ success: true, call_log_id: callLog.id });
    }

    return NextResponse.json({ error: "Unsupported PBX event" }, { status: 400 });
  } catch (err: any) {
    console.error("SIP Webhook processing failed:", err);
    return NextResponse.json({ error: err.message || "Failed to process SIP webhook" }, { status: 500 });
  }
}
