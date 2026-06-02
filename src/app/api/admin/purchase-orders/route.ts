import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { purchaseOrderWriteSchema } from "@/lib/schemas/purchase-order";
import { logAdminAction } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ purchaseOrders: data ?? [] });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = purchaseOrderWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAdminAction(request, {
    action: "create",
    entity: "purchase_order",
    entity_id: data?.id,
    diff: { brand: parsed.data.brand, model: parsed.data.model, qty: parsed.data.qty },
  }).catch(() => {});

  return NextResponse.json({ success: true, id: data?.id }, { status: 201 });
}
