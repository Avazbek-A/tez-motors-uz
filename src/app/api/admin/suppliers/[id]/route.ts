import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  contact: z.string().max(200).optional().nullable(),
  whatsapp: z.string().max(40).optional().nullable(),
  country: z.string().max(40).optional().nullable(),
  lead_time_days: z.number().int().min(0).max(365).optional().nullable(),
  moq: z.number().int().min(0).max(10000).optional().nullable(),
  payment_terms: z.string().max(200).optional().nullable(),
  reliability_score: z.number().int().min(0).max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  logAdminAction(request, { action: "update", entity: "supplier", entity_id: id, diff: parsed.data }).catch(() => {});
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const { id } = await params;
  const supabase = createServiceClient();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  logAdminAction(request, { action: "delete", entity: "supplier", entity_id: id }).catch(() => {});
  return NextResponse.json({ success: true });
}
