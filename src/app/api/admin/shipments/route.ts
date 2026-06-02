import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("shipments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shipments: data ?? [] });
}

const createSchema = z.object({
  title: z.string().min(2).max(200),
  supplier: z.string().max(200).optional().nullable(),
  mode: z.enum(["sea", "rail", "road", "air", "multimodal"]).optional(),
  container_no: z.string().max(60).optional().nullable(),
  origin: z.string().max(120).optional().nullable(),
  destination: z.string().max(120).optional().nullable(),
  qty: z.number().int().min(1).max(10000).optional().nullable(),
  eta_date: z.string().max(20).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  purchase_order_id: z.string().uuid().optional().nullable(),
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
    .from("shipments")
    .insert({ ...parsed.data, mode: parsed.data.mode || "rail", status: "created" })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Seed the timeline with the creation milestone.
  await supabase.from("shipment_events").insert({ shipment_id: data!.id, milestone: "created", note: "Shipment created" }).then(() => {}, () => {});

  logAdminAction(request, { action: "create", entity: "shipment", entity_id: data?.id, diff: { title: parsed.data.title } }).catch(() => {});
  return NextResponse.json({ success: true, id: data?.id }, { status: 201 });
}
