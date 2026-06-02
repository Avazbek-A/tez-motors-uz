import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { contactKey } from "@/lib/crm";

/** Sales task queue — list (with assignee directory) + create. Admin-gated. */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const sp = new URL(request.url).searchParams;
  const status = sp.get("status") || "open";
  const assigned = sp.get("assigned");

  const supabase = createServiceClient();
  let query = supabase.from("crm_tasks").select("*").order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(500);
  if (status !== "all") query = query.eq("status", status);
  if (assigned === "unassigned") query = query.is("assigned_to", null);
  else if (assigned) query = query.eq("assigned_to", assigned);

  const [{ data: tasks, error }, { data: assignees }] = await Promise.all([
    query,
    supabase.from("admin_users").select("id, email, name").limit(100),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: tasks || [], assignees: assignees || [] });
}

const createSchema = z.object({
  title: z.string().min(2).max(300),
  kind: z.enum(["follow_up", "call", "message", "stale_lead", "abandoned_deposit", "handoff", "review", "manual"]).optional(),
  customer_phone: z.string().max(30).optional().nullable(),
  customer_name: z.string().max(120).optional().nullable(),
  inquiry_id: z.string().uuid().optional().nullable(),
  order_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  due_at: z.string().max(40).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("crm_tasks")
    .insert({
      ...parsed.data,
      kind: parsed.data.kind || "manual",
      customer_key: parsed.data.customer_phone ? contactKey(parsed.data.customer_phone) : null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  logAdminAction(request, { action: "create", entity: "crm_task", entity_id: data?.id, diff: { title: parsed.data.title } }).catch(() => {});
  return NextResponse.json({ success: true, id: data?.id }, { status: 201 });
}
