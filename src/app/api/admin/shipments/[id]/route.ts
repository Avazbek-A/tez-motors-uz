import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { isValidMilestone } from "@/lib/shipment-flow";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { id } = await params;
  const supabase = createServiceClient();
  const [{ data: shipment }, { data: events }, { data: documents }] = await Promise.all([
    supabase.from("shipments").select("*").eq("id", id).maybeSingle(),
    supabase.from("shipment_events").select("milestone, note, created_at").eq("shipment_id", id).order("created_at", { ascending: false }).limit(200),
    supabase.from("shipment_documents").select("id, kind, url, filename, created_at").eq("shipment_id", id).order("created_at", { ascending: false }).limit(100),
  ]);
  if (!shipment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ shipment, events: events ?? [], documents: documents ?? [] });
}

const patchSchema = z.object({
  status: z.string().max(40).optional(),
  status_note: z.string().max(500).optional(),
  title: z.string().min(2).max(200).optional(),
  supplier: z.string().max(200).optional().nullable(),
  mode: z.enum(["sea", "rail", "road", "air", "multimodal"]).optional(),
  container_no: z.string().max(60).optional().nullable(),
  qty: z.number().int().min(1).max(10000).optional().nullable(),
  eta_date: z.string().max(20).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const { status, status_note, ...rest } = parsed.data;
  if (status !== undefined && !isValidMilestone(status)) {
    return NextResponse.json({ error: "Invalid milestone" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const update: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };
  if (status !== undefined) update.status = status;

  const { error } = await supabase.from("shipments").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // A milestone change appends to the timeline.
  if (status !== undefined) {
    await supabase.from("shipment_events").insert({ shipment_id: id, milestone: status, note: status_note || null }).then(() => {}, () => {});
  }

  logAdminAction(request, { action: "update", entity: "shipment", entity_id: id, diff: { status, ...rest } }).catch(() => {});
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { id } = await params;
  const supabase = createServiceClient();
  const { error } = await supabase.from("shipments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAdminAction(request, { action: "delete", entity: "shipment", entity_id: id }).catch(() => {});
  return NextResponse.json({ success: true });
}
