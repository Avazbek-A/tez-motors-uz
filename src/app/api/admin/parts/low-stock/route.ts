import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";

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
    .select("id, slug, name_ru, oem_number, category, stock_qty, min_order_qty")
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

const restockSchema = z.object({
  id: z.string().uuid(),
  add: z.number().int().min(1).max(100000),
});

/**
 * Records a restock: adds the received quantity to a part's stock_qty and writes
 * an audit row. Read-then-write is fine here — admin-only, low frequency.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const parsed = restockSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: existing, error: readErr } = await supabase
    .from("parts")
    .select("id, name_ru, stock_qty")
    .eq("id", parsed.data.id)
    .single();

  if (readErr || !existing) {
    return NextResponse.json({ error: "Part not found" }, { status: 404 });
  }

  const before = Number(existing.stock_qty) || 0;
  const after = before + parsed.data.add;

  const { error: updErr } = await supabase
    .from("parts")
    .update({ stock_qty: after })
    .eq("id", parsed.data.id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  logAdminAction(request, {
    action: "restock",
    entity: "part",
    entity_id: parsed.data.id,
    diff: { name_ru: existing.name_ru, added: parsed.data.add, stock_qty: { before, after } },
  }).catch(() => {});

  return NextResponse.json({ success: true, id: parsed.data.id, stock_qty: after });
}
