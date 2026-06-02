import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const supabase = createServiceClient();
  const { data, error } = await supabase.from("content_drafts").select("*").order("created_at", { ascending: false }).limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drafts: data ?? [] });
}

const schema = z.object({
  kind: z.enum(["telegram", "instagram", "facebook", "ad", "blog", "promo"]),
  locale: z.enum(["ru", "uz", "en"]),
  subject: z.string().max(300).optional().nullable(),
  car_id: z.string().uuid().optional().nullable(),
  body: z.string().min(1).max(8000),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase.from("content_drafts").insert(parsed.data).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAdminAction(request, { action: "create", entity: "content_draft", entity_id: data?.id, diff: { kind: parsed.data.kind, locale: parsed.data.locale } }).catch(() => {});
  return NextResponse.json({ success: true, id: data?.id }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const supabase = createServiceClient();
  const { error } = await supabase.from("content_drafts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
