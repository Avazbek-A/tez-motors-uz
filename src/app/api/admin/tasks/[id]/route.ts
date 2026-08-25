import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";

const patchSchema = z.object({
  status: z.enum(["open", "done", "snoozed"]).optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  due_at: z.string().max(40).optional().nullable(),
  title: z.string().min(2).max(300).optional(),
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

  const update: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };
  if (parsed.data.status === "done") update.completed_at = new Date().toISOString();
  if (parsed.data.status && parsed.data.status !== "done") update.completed_at = null;

  const supabase = createServiceClient();
  const { data: updated, error } = await supabase.from("crm_tasks").update(update).eq("id", id).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated || updated.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  logAdminAction(request, { action: "update", entity: "crm_task", entity_id: id, diff: parsed.data }).catch(() => {});
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { id } = await params;
  const supabase = createServiceClient();
  const { data: deleted, error } = await supabase.from("crm_tasks").delete().eq("id", id).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!deleted || deleted.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  logAdminAction(request, { action: "delete", entity: "crm_task", entity_id: id }).catch(() => {});
  return NextResponse.json({ success: true });
}
