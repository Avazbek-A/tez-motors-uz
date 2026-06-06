import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { partWriteSchema } from "@/lib/schemas/part";
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

  const parsed = partWriteSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  // Zod's .partial() still injects .default() values for keys the admin omitted,
  // so writing parsed.data directly resets stock_qty/is_published/images/fitment
  // to defaults on a single-field edit (data loss). Keep only fields actually sent.
  const raw = (body ?? {}) as Record<string, unknown>;
  const update = Object.fromEntries(Object.entries(parsed.data).filter(([k]) => k in raw));

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("parts")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logAdminAction(request, {
    action: "update",
    entity: "part",
    entity_id: id,
    diff: compactDiff(update),
  }).catch(() => {});

  return NextResponse.json({ part: data });
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
  const { error } = await supabase.from("parts").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logAdminAction(request, { action: "delete", entity: "part", entity_id: id }).catch(() => {});

  return NextResponse.json({ success: true });
}
