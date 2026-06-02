import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { draftSupplierMessage, type SupplierMessageKind } from "@/lib/supplier-ai";

const KINDS: SupplierMessageKind[] = ["rfq", "follow_up", "eta", "price_check"];

/**
 * Draft a WhatsApp message to the supplier for one purchase order. AI-assisted
 * (bilingual 中文/English), grounded on the PO; the dealer reviews and sends via
 * a wa.me link. Fail-open to a clean template when no LLM key is set.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { id } = await params;
  let body: { kind?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body → default to rfq
  }
  const kind: SupplierMessageKind = KINDS.includes(body.kind as SupplierMessageKind)
    ? (body.kind as SupplierMessageKind)
    : "rfq";

  const supabase = createServiceClient();
  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select("supplier, brand, model, trim, year, qty, unit_cost_usd, status, eta_date")
    .eq("id", id)
    .single();

  if (error || !po) {
    return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
  }

  const { text, ai } = await draftSupplierMessage(kind, po);
  return NextResponse.json({ text, ai, kind });
}
