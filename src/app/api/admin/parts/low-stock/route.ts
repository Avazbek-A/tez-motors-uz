import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * Returns parts at or below the low-stock threshold so the admin dashboard
 * can surface what needs to be reordered. Published parts only — if it's
 * not on the public site, running out doesn't hurt anyone.
 *
 * Query:
 *   ?threshold=5   (default 5)
 *   ?limit=25      (default 25, max 100)
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const url = new URL(request.url);
  const threshold = Math.max(
    0,
    Math.min(1000, Number.parseInt(url.searchParams.get("threshold") ?? "5", 10) || 5),
  );
  const limit = Math.max(
    1,
    Math.min(100, Number.parseInt(url.searchParams.get("limit") ?? "25", 10) || 25),
  );

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("parts")
    .select("id, slug, name_ru, oem_number, category, stock_qty")
    .eq("is_published", true)
    .lte("stock_qty", threshold)
    .order("stock_qty", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    threshold,
    parts: data ?? [],
  });
}
