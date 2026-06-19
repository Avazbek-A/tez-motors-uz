import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminSessionContext, requireAdmin, isAdminRequest } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { logAdminAction } from "@/lib/audit";
import { reportServerError } from "@/lib/error-report";
import { safeHttpUrlNullable } from "@/lib/schemas/safe-url";
import { googleSubmitSitemap, yandexSubmitSitemap } from "@/lib/seo/webmaster";

const schema = z.object({
  slug: z.string().max(200).optional().or(z.literal("")),
  title_ru: z.string().min(1).max(200),
  title_uz: z.string().max(200).optional().nullable(),
  title_en: z.string().max(200).optional().nullable(),
  body_ru: z.string().min(1).max(50_000),
  body_uz: z.string().max(50_000).optional().nullable(),
  body_en: z.string().max(50_000).optional().nullable(),
  cover_image: safeHttpUrlNullable, // http(s) only — never javascript:/data:/file:
  is_published: z.boolean().default(false),
  category: z.string().max(100).optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  read_time_minutes: z.number().int().nonnegative().optional().nullable(),
  meta_title_ru: z.string().max(200).optional().nullable(),
  meta_title_uz: z.string().max(200).optional().nullable(),
  meta_title_en: z.string().max(200).optional().nullable(),
  meta_description_ru: z.string().max(500).optional().nullable(),
  meta_description_uz: z.string().max(500).optional().nullable(),
  meta_description_en: z.string().max(500).optional().nullable(),
  faqs: z.array(z.object({
    question_ru: z.string().max(300),
    question_uz: z.string().max(300).optional().nullable(),
    question_en: z.string().max(300).optional().nullable(),
    answer_ru: z.string().max(2000),
    answer_uz: z.string().max(2000).optional().nullable(),
    answer_en: z.string().max(2000).optional().nullable(),
  })).optional().nullable(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // `all=true` exposes unpublished drafts → admin only. A public caller passing it
  // must still get published-only (was an ungated draft-leak).
  const all = searchParams.get("all") === "true" && (await isAdminRequest(request).catch(() => false));
  const supabase = createServiceClient();
  let query = supabase.from("posts").select("*, author:blog_authors(*)");
  if (!all) query = query.eq("is_published", true);
  const { data, error } = await query.order("published_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  if (error) {
    // Log to observability; never echo Supabase error.message to anon callers
    reportServerError("GET /api/posts list", error).catch(() => {});
    return NextResponse.json({ posts: [], error: "Query failed" }, { status: 500 });
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
      category: parsed.data.category || null,
      tags: parsed.data.tags || [],
      read_time_minutes: parsed.data.read_time_minutes || null,
      meta_title_ru: parsed.data.meta_title_ru || null,
      meta_title_uz: parsed.data.meta_title_uz || null,
      meta_title_en: parsed.data.meta_title_en || null,
      meta_description_ru: parsed.data.meta_description_ru || null,
      meta_description_uz: parsed.data.meta_description_uz || null,
      meta_description_en: parsed.data.meta_description_en || null,
      faqs: parsed.data.faqs || [],
    })
    .select("*, author:blog_authors(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Trigger sitemap ping on publish
  if (parsed.data.is_published) {
    Promise.all([googleSubmitSitemap(), yandexSubmitSitemap()]).catch(() => {});
  }

  logAdminAction(request, {
    action: "create",
    entity: "post",
    entity_id: data?.id,
    diff: { slug, title_ru: parsed.data.title_ru, is_published: parsed.data.is_published },
  }).catch(() => {});

  return NextResponse.json({ success: true, post: data }, { status: 201 });
}
