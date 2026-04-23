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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "true";
  const supabase = createServiceClient();
  let query = supabase.from("posts").select("*");
  if (!all) query = query.eq("is_published", true);
  const { data, error } = await query.order("published_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ posts: [], error: error.message }, { status: 500 });
  }
  return NextResponse.json({ posts: data || [] });
}

export async function POST(request: NextRequest) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;

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
    .insert({
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
      author_id: ctx?.user?.id ?? null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, post: data }, { status: 201 });
}
