import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { validateSteps, JOURNEY_TRIGGERS, type JourneyStep } from "@/lib/automation/journey";

/**
 * Marketing-automation journeys CRUD (Phase AW). Admin-gated. GET lists journeys
 * with live enrollment counts; POST creates; PATCH edits / pauses-activates;
 * DELETE removes (cascades enrollments). Service-role only.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const supabase = createServiceClient();

  const [jRes, eRes] = await Promise.all([
    supabase.from("automation_journeys").select("id, name, trigger_event, status, steps, created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("journey_enrollments").select("journey_id, status").limit(20000),
  ]);

  const counts = new Map<string, { active: number; completed: number; converted: number; total: number }>();
  for (const e of eRes.data || []) {
    const id = e.journey_id as string;
    const c = counts.get(id) || { active: 0, completed: 0, converted: 0, total: 0 };
    c.total += 1;
    if (e.status === "active") c.active += 1;
    else if (e.status === "completed") c.completed += 1;
    else if (e.status === "converted") c.converted += 1;
    counts.set(id, c);
  }
  const journeys = (jRes.data || []).map((j) => {
    const c = counts.get(j.id as string) || { active: 0, completed: 0, converted: 0, total: 0 };
    return {
      ...j,
      step_count: Array.isArray(j.steps) ? (j.steps as unknown[]).length : 0,
      enrolled_active: c.active,
      enrolled_completed: c.completed,
      enrolled_converted: c.converted,
      // Conversion rate over contacts that have left the active state.
      conversion_rate: c.total > 0 ? Math.round((c.converted / c.total) * 1000) / 10 : 0,
    };
  });
  return NextResponse.json({ journeys, triggers: JOURNEY_TRIGGERS });
}

const stepSchema = z.object({
  delayHours: z.number().min(0).max(8760),
  channel: z.string().max(20).optional().nullable(),
  subject: z.string().max(200).optional(),
  body: z.string().min(1).max(2000),
  url: z.string().max(500).optional(),
  buttonLabel: z.string().max(60).optional(),
});
const createSchema = z.object({
  name: z.string().min(1).max(120),
  trigger_event: z.enum(JOURNEY_TRIGGERS),
  status: z.enum(["active", "paused"]).optional(),
  steps: z.array(stepSchema).min(1).max(12),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  const v = validateSteps(parsed.data.steps as JourneyStep[]);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("automation_journeys")
    .insert({ name: parsed.data.name, trigger_event: parsed.data.trigger_event, status: parsed.data.status ?? "paused", steps: parsed.data.steps })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  logAdminAction(request, { action: "create", entity: "journey", entity_id: data.id, diff: { name: parsed.data.name, trigger: parsed.data.trigger_event } }).catch(() => {});
  return NextResponse.json({ success: true, id: data.id }, { status: 201 });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  status: z.enum(["active", "paused"]).optional(),
  steps: z.array(stepSchema).min(1).max(12).optional(),
});

export async function PATCH(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (parsed.data.steps) {
    const v = validateSteps(parsed.data.steps as JourneyStep[]);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.steps !== undefined) patch.steps = parsed.data.steps;

  const supabase = createServiceClient();
  const { error } = await supabase.from("automation_journeys").update(patch).eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  logAdminAction(request, { action: "update", entity: "journey", entity_id: parsed.data.id, diff: { status: parsed.data.status } }).catch(() => {});
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const supabase = createServiceClient();
  const { error } = await supabase.from("automation_journeys").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  logAdminAction(request, { action: "delete", entity: "journey", entity_id: id }).catch(() => {});
  return NextResponse.json({ success: true });
}
