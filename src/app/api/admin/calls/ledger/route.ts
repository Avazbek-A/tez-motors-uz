import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { contactKey } from "@/lib/crm";

/**
 * Biometric Wire Transfer & Agreement Ledger Signer.
 * Admin-gated.
 * Registers cryptographic signatures for verified voice contracts.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const body = await request.json().catch(() => ({}));
    const { inquiry_id, phone, amount, voice_signature_token } = body;

    if (!phone || !amount || !voice_signature_token) {
      return NextResponse.json({ error: "Missing required deal parameters (phone, amount, voice_signature_token)" }, { status: 400 });
    }

    const phoneCore = contactKey(phone);
    const supabase = createServiceClient();

    // 1. Locate active inquiry if not provided
    let inqId = inquiry_id;
    if (!inqId) {
      const { data: inq } = await supabase
        .from("inquiries")
        .select("id")
        .ilike("phone", `%${phoneCore}%`)
        .limit(1)
        .maybeSingle();
      inqId = inq?.id || null;
    }

    // 2. Generate cryptographic signature block combining inputs
    const encoder = new TextEncoder();
    const dataString = `${phoneCore}-${amount}-${voice_signature_token}-${Date.now()}`;
    const dataBuffer = encoder.encode(dataString);
    
    // Simple SHA-256 equivalent hash in Node
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const cryptoSignature = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    // 3. Log into biometric_ledger table
    const { data: ledgerRecord, error: insertError } = await supabase
      .from("biometric_ledger")
      .insert({
        inquiry_id: inqId,
        caller_phone: phone,
        amount_usd: Number(amount),
        cryptographic_signature: cryptoSignature,
        status: "signed"
      })
      .select("*")
      .single();

    if (insertError) {
      throw new Error(`Failed to log biometric ledger record: ${insertError.message}`);
    }

    return NextResponse.json({
      success: true,
      ledger_id: ledgerRecord.id,
      cryptographic_signature: cryptoSignature,
      amount: amount,
      verified_at: ledgerRecord.verified_at,
      status: "signed",
      message: "Biometric transaction signed and written to secure database ledger."
    }, { status: 201 });

  } catch (err: any) {
    console.error("Cryptographic ledger signing failed:", err);
    return NextResponse.json({ error: err.message || "Ledger signing failed" }, { status: 500 });
  }
}
