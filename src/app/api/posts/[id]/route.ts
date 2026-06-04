import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminSessionContext, requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { logAdminAction } from "@/lib/audit";
import { safeHttpUrlNullable } from "@/lib/schemas/safe-url";

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
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // SECURITY: validate the path segment as a UUID or a safe slug. The previous
  // implementation interpolated `id` into a PostgREST .or() filter string, which
  // is a query-construction context — special chars (',' '.' '(' ')') change
  // the predicate. A crafted URL like `/api/posts/x,is_published.eq.false` would
  // leak unpublished drafts via OR'd conditions. Strict char-class kills the
  // surface; we also use two separate .eq() lookups instead of .or() — both
  // properly parameter-bind values.
  if (!id || id.length > 200 || !/^[A-Za-z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Admin sessions can preview drafts (?preview=true); anon callers ONLY ever
  // see published posts. Service-role bypasses RLS, so the filter is mandatory.
  const previewAllowed = !!(await getAdminSessionContext(request));
  const supabase = createServiceClient();

  // Try by id (UUID) first, then by slug — each is a single .eq(), never a
  // string-built filter expression.
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  let q = supabase.from("posts").select("*");
  if (!previewAllowed) q = q.eq("is_published", true);

  let { data, error } = looksLikeUuid
    ? await q.eq("id", id).maybeSingle()
    : await q.eq("slug", id).maybeSingle();

  if ((!data && !error) && looksLikeUuid) {
    // Fall back to slug lookup if the input happened to be a UUID-shaped slug.
    let q2 = supabase.from("posts").select("*");
    if (!previewAllowed) q2 = q2.eq("is_published", true);
    const result = await q2.eq("slug", id).maybeSingle();
    data = result.data;
    error = result.error;
  }

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

  logAdminAction(request, {
    action: "update",
    entity: "post",
    entity_id: id,
    diff: { slug, title_ru: parsed.data.title_ru, is_published: parsed.data.is_published },
  }).catch(() => {});

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

  logAdminAction(request, { action: "delete", entity: "post", entity_id: id }).catch(() => {});

  return NextResponse.json({ success: true });
}
