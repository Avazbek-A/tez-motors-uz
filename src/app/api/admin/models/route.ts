import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { modelWriteSchema } from "@/lib/schemas/model";
import { logAdminAction } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("model_catalog")
    .select("*")
    .order("order_position", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ models: [], error: error.message }, { status: 500 });
  }
  return NextResponse.json({ models: data || [], total: data?.length || 0 });
}

export async function POST(request: NextRequest) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = modelWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("model_catalog")
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logAdminAction(request, {
    action: "create",
    entity: "model",
    entity_id: data?.id,
    diff: { brand: parsed.data.brand, model: parsed.data.model, slug: parsed.data.slug },
  }).catch(() => {});

  return NextResponse.json({ model: data }, { status: 201 });
}
