import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { resolveAutopilot, AUTOPILOT_ROW_ID } from "@/lib/autopilot";

/**
 * Autopilot control plane (Phase AH) — read/write the autonomous-ops config in
 * site_settings('autopilot'). Admin-gated. Every flag defaults OFF; resolve
 * clamps all bounds so a bad value can't widen the blast radius.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const supabase = createServiceClient();
  const { data } = await supabase.from("site_settings").select("values").eq("id", AUTOPILOT_ROW_ID).maybeSingle();
  return NextResponse.json({ ok: true, config: resolveAutopilot(data?.values) });
}

export async function PUT(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  // Resolve (= validate + clamp) before persisting, so only safe values land.
  const config = resolveAutopilot(body);
  const supabase = createServiceClient();
  const { error } = await supabase.from("site_settings").upsert({ id: AUTOPILOT_ROW_ID, values: config, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  logAdminAction(request, { action: "settings", entity: "autopilot", entity_id: AUTOPILOT_ROW_ID, diff: { master: config.master, autoMarkdown: config.autoMarkdown.enabled, autoSource: config.autoSourceDrafts.enabled } }).catch(() => {});
  return NextResponse.json({ ok: true, config });
}
