import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { reviewWriteSchema } from "@/lib/schemas/car";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction, compactDiff } from "@/lib/audit";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;
  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = reviewWriteSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, errors: parsed.error.issues }, { status: 400 });
    }
    // .partial() re-injects .default() values for omitted keys; keep only the
    // fields actually sent so a single-field edit can't reset others to defaults.
    const raw = (body ?? {}) as Record<string, unknown>;
    const update = Object.fromEntries(Object.entries(parsed.data).filter(([k]) => k in raw));
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("reviews")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    logAdminAction(request, {
      action: "update",
      entity: "review",
      entity_id: id,
      diff: compactDiff(update),
    }).catch(() => {});

    return NextResponse.json({ success: true, review: data });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to update review" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;
  const { id } = await params;

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("reviews").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    logAdminAction(request, { action: "delete", entity: "review", entity_id: id }).catch(() => {});

    return NextResponse.json({ success: true, deleted: id });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to delete review" }, { status: 500 });
  }
}
