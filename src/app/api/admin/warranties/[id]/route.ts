import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { warrantyUntil, type ServiceRecord } from "@/lib/warranty";

const patchSchema = z.object({
  warranty_months: z.number().int().min(0).max(120).optional(),
  delivered_at: z.string().max(20).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  // Append a service record.
  add_service: z
    .object({
      date: z.string().max(20),
      odometer_km: z.number().int().min(0).max(2_000_000).optional().nullable(),
      description: z.string().min(1).max(500),
      cost_usd: z.number().min(0).max(1_000_000).optional().nullable(),
    })
    .optional(),
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

  const supabase = createServiceClient();
  const { data: cur } = await supabase.from("warranties").select("delivered_at, warranty_months, services").eq("id", id).maybeSingle();
  if (!cur) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;
  const delivered = parsed.data.delivered_at !== undefined ? parsed.data.delivered_at : cur.delivered_at;
  const months = parsed.data.warranty_months ?? cur.warranty_months;
  if (parsed.data.delivered_at !== undefined) update.delivered_at = parsed.data.delivered_at;
  if (parsed.data.warranty_months !== undefined) update.warranty_months = parsed.data.warranty_months;
  if (parsed.data.delivered_at !== undefined || parsed.data.warranty_months !== undefined) {
    update.warranty_until = warrantyUntil(delivered as string | null, months as number);
  }
  if (parsed.data.add_service) {
    const services = (Array.isArray(cur.services) ? cur.services : []) as ServiceRecord[];
    services.push(parsed.data.add_service);
    update.services = services;
  }

  const { error } = await supabase.from("warranties").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAdminAction(request, { action: "update", entity: "warranty", entity_id: id, diff: { service: !!parsed.data.add_service } }).catch(() => {});
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { id } = await params;
  const supabase = createServiceClient();
  const { error } = await supabase.from("warranties").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  logAdminAction(request, { action: "delete", entity: "warranty", entity_id: id }).catch(() => {});
  return NextResponse.json({ success: true });
}
