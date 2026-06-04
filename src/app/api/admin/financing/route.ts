import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";

/**
 * Admin financing + insurance queues (Phase AP). GET both lists; PATCH advances
 * an application/lead status. Read/manage only — binding happens with a partner.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const supabase = createServiceClient();
  const [appsRes, insRes] = await Promise.all([
    supabase
      .from("financing_applications")
      .select("id, customer_name, customer_phone, car_id, down_pct, term_months, estimated_monthly, employment, income_band, status, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("insurance_leads")
      .select("id, customer_name, customer_phone, car_id, type, estimated_premium_usd, status, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  return NextResponse.json({ applications: appsRes.data || [], insurance: insRes.data || [] });
}

const patchSchema = z.object({
  kind: z.enum(["financing", "insurance"]),
  id: z.string().uuid(),
  status: z.string().max(20),
});

export async function PATCH(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const supabase = createServiceClient();
  const table = parsed.data.kind === "financing" ? "financing_applications" : "insurance_leads";
  const allowed =
    parsed.data.kind === "financing"
      ? ["new", "submitted", "approved", "declined"]
      : ["new", "contacted", "bound", "lost"];
  if (!allowed.includes(parsed.data.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const { error } = await supabase.from(table).update({ status: parsed.data.status }).eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  logAdminAction(request, { action: "status_change", entity: parsed.data.kind, entity_id: parsed.data.id, diff: { status: parsed.data.status } }).catch(() => {});
  return NextResponse.json({ success: true });
}
