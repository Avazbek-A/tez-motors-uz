import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminSessionContext, requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/utils";

const schema = z.object({
  slug: z.string().max(200).optional().or(z.literal("")),
  title_ru: z.string().min(1).max(200),
  title_uz: z.string().max(200).optional().nullable(),
  title_en: z.string().max(200).optional().nullable(),
  body_ru: z.string().min(1).max(50_000),
  body_uz: z.string().max(50_000).optional().nullable(),
  body_en: z.string().max(50_000).optional().nullable(),
  cover_image: z.string().url().optional().nullable(),
  is_published: z.boolean().default(false),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .or(`id.eq.${id},slug.eq.${id}`)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json({ post: data });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createServiceClient();
  const ctx = await getAdminSessionContext(request);
  const slug = (parsed.data.slug || slugify(parsed.data.title_ru)).slice(0, 200);
  const { data, error } = await supabase
    .from("posts")
    .update({
      slug,
      title_ru: parsed.data.title_ru,
      title_uz: parsed.data.title_uz || null,
      title_en: parsed.data.title_en || null,
      body_ru: parsed.data.body_ru,
      body_uz: parsed.data.body_uz || null,
      body_en: parsed.data.body_en || null,
      cover_image: parsed.data.cover_image || null,
      is_published: parsed.data.is_published,
      published_at: parsed.data.is_published ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
      author_id: ctx?.user?.id ?? null,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, post: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;
  const { id } = await params;

  const supabase = createServiceClient();
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
