import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

// GET - paginated admin audit feed (read-only). Service-role table, admin-gated.
export async function GET(request: NextRequest) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(parseInt(searchParams.get("page") || "1") || 1, 1);
  const size = Math.min(parseInt(searchParams.get("page_size") || "50") || 50, 100);
  const entity = searchParams.get("entity")?.slice(0, 32) || null;
  const action = searchParams.get("action")?.slice(0, 32) || null;
  const offset = (page - 1) * size;

  const supabase = createServiceClient();
  let query = supabase
    .from("admin_audit")
    .select("id, actor_admin_id, actor_email, action, entity, entity_id, diff, ip, created_at", {
      count: "exact",
    });

  if (entity) query = query.eq("entity", entity);
  if (action) query = query.eq("action", action);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + size - 1);

  if (error) {
    return NextResponse.json({ entries: [], total: 0, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    entries: data || [],
    total: count || 0,
    page,
    page_size: size,
  });
}
