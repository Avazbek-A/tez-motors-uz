import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import { normalizeReferenceCode } from "@/lib/order-code";
import { loosePhone } from "@/lib/phone";
import { buildOrderDocument } from "@/lib/documents/build-for-order";
import type { DocType, DocLocale } from "@/lib/documents/templates";

/**
 * Public document e-signature (Phase AR). Gated on reference_code + phone (same
 * posture as /track and /receipt — service-role, rate-limited, constant
 * "not found" on mismatch, never enumerable by code alone).
 *
 *  GET  ?code=&phone=&type= → the rendered contract HTML to review + sign,
 *       plus whether it's already signed.
 *  POST { code, phone, type, signer_name, signature_text, signature_image?,
 *       agreed } → record the signature, append an order event.
 */
const checkRateLimit = createKvRateLimiter({ max: 10, windowMs: 5 * 60 * 1000, prefix: "sign" });

// Signable customer-facing documents (a subset of DocType).
const SIGNABLE: DocType[] = ["sales_contract", "deposit_receipt", "handover_act"];
const isSignable = (t: string): t is DocType => (SIGNABLE as string[]).includes(t);
const toDocLocale = (l: string | null): DocLocale => (l === "uz" ? "uz" : "ru");

async function resolveOrder(code: string, phone: string) {
  const supabase = createServiceClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, reference_code, customer_name, customer_phone, locale")
    .eq("reference_code", normalizeReferenceCode(code))
    .single();
  if (!order || loosePhone(order.customer_phone) !== loosePhone(phone)) return null;
  return order;
}

export async function GET(request: NextRequest) {
  if (!(await checkRateLimit(getClientIp(request)))) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }
  const sp = request.nextUrl.searchParams;
  const code = sp.get("code");
  const phone = sp.get("phone");
  const type = sp.get("type") || "sales_contract";
  if (!code || !phone || phone.trim().length < 5 || !isSignable(type)) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const order = await resolveOrder(code, phone);
  if (!order) return NextResponse.json({ ok: true, found: false });

  const supabase = createServiceClient();
  const doc = await buildOrderDocument(supabase, order.id, type, toDocLocale(order.locale));
  const { data: existing } = await supabase
    .from("document_signatures")
    .select("id, signed_at, signer_name")
    .eq("order_id", order.id)
    .eq("document_type", type)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    found: true,
    order: { reference_code: order.reference_code, customer_name: order.customer_name },
    title: doc?.title ?? "",
    html: doc?.html ?? "",
    signed: existing ? { at: existing.signed_at, name: existing.signer_name } : null,
  });
}

const postSchema = z.object({
  code: z.string().min(3).max(40),
  phone: z.string().min(5).max(20),
  type: z.string().refine(isSignable, "unsignable document type"),
  signer_name: z.string().min(2).max(120),
  signature_text: z.string().max(120).optional().nullable(),
  // Optional drawn signature data URL — capped (a PNG signature is a few KB).
  signature_image: z.string().max(200_000).optional().nullable(),
  agreed: z.literal(true),
});

export async function POST(request: NextRequest) {
  if (!(await checkRateLimit(getClientIp(request)))) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const d = parsed.data;
  // A drawn signature, if present, must be an https/ data:image payload.
  if (d.signature_image && !/^data:image\//.test(d.signature_image)) {
    return NextResponse.json({ ok: false, error: "Invalid signature image" }, { status: 400 });
  }

  const order = await resolveOrder(d.code, d.phone);
  if (!order) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const supabase = createServiceClient();
  const { error } = await supabase.from("document_signatures").insert({
    order_id: order.id,
    document_type: d.type,
    signer_name: d.signer_name,
    signer_phone: loosePhone(d.phone),
    signature_text: d.signature_text ?? d.signer_name,
    signature_image: d.signature_image ?? null,
    agreed: true,
    ip: getClientIp(request).slice(0, 64),
    user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
  });
  if (error) return NextResponse.json({ ok: false, error: "Failed to record signature" }, { status: 500 });

  // Append a timeline event (best-effort) so the dealer sees it on the order.
  await supabase
    .from("order_events")
    .insert({ order_id: order.id, status: "signed", note: `Document signed: ${d.type} by ${d.signer_name}` })
    .then(() => {}, () => {});

  return NextResponse.json({ ok: true });
}
