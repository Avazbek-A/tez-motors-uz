import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { purchaseOrderUpdateSchema } from "@/lib/schemas/purchase-order";
import { logAdminAction } from "@/lib/audit";

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
  const parsed = purchaseOrderUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("purchase_orders")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAdminAction(request, {
    action: "update",
    entity: "purchase_order",
    entity_id: id,
    diff: parsed.data,
  }).catch(() => {});

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { id } = await params;
  const supabase = createServiceClient();
  const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAdminAction(request, { action: "delete", entity: "purchase_order", entity_id: id }).catch(() => {});
  return NextResponse.json({ success: true });
}
