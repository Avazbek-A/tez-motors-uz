import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";

/** Attach / remove a shipment document (a URL reference: invoice, customs
 *  declaration, certificate, …). The file itself lives in Storage or any host;
 *  this records the link + kind. */
const addSchema = z.object({
  kind: z.enum(["invoice", "packing_list", "bill_of_lading", "customs_declaration", "certificate", "other"]),
  url: z.string().url().max(1000),
  filename: z.string().max(200).optional().nullable(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("shipment_documents")
    .insert({ shipment_id: id, ...parsed.data })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAdminAction(request, { action: "create", entity: "shipment_document", entity_id: id, diff: { kind: parsed.data.kind } }).catch(() => {});
  return NextResponse.json({ success: true, id: data?.id }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { id } = await params;
  const docId = new URL(request.url).searchParams.get("doc");
  if (!docId) return NextResponse.json({ error: "doc id required" }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase.from("shipment_documents").delete().eq("id", docId).eq("shipment_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
