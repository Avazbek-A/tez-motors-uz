import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";

/** Cancel a promotion. If it's already active, revert the car's price first. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { id } = await params;
  const supabase = createServiceClient();
  const { data: promo } = await supabase.from("promotions").select("car_id, status, pre_promo_price_usd").eq("id", id).maybeSingle();
  if (!promo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (promo.status === "active" && promo.pre_promo_price_usd != null) {
    await supabase.from("cars").update({ price_usd: promo.pre_promo_price_usd, original_price_usd: null }).eq("id", promo.car_id);
  }
  const { error } = await supabase.from("promotions").update({ status: "cancelled" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAdminAction(request, { action: "update", entity: "promotion", entity_id: id, diff: { status: "cancelled" } }).catch(() => {});
  return NextResponse.json({ success: true });
}
