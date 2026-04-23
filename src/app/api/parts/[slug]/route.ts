import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  if (!slug || !/^[a-z0-9-]{1,120}$/i.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const all = new URL(request.url).searchParams.get("all") && (await isAdminRequest(request));
  const supabase = all ? createServiceClient() : await createClient();

  let query = supabase.from("parts").select("*").eq("slug", slug).maybeSingle();
  if (!all) query = supabase.from("parts").select("*").eq("slug", slug).eq("is_published", true).maybeSingle();

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(
    { part: data },
    {
      headers: all ? {} : { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    },
  );
}
