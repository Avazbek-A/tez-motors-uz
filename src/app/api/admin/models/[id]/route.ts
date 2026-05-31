import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { modelUpdateSchema } from "@/lib/schemas/model";
import { logAdminAction, compactDiff } from "@/lib/audit";

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = modelUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("model_catalog")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logAdminAction(request, {
    action: "update",
    entity: "model",
    entity_id: id,
    diff: compactDiff(parsed.data as Record<string, unknown>),
  }).catch(() => {});

  return NextResponse.json({ model: data });
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;

  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase.from("model_catalog").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logAdminAction(request, { action: "delete", entity: "model", entity_id: id }).catch(() => {});

  return NextResponse.json({ success: true });
}
