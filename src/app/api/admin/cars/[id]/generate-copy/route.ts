import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { generateCarCopy } from "@/lib/content-ai";
import { logAdminAction } from "@/lib/audit";

/**
 * Auto-write a car's RU/UZ/EN listing descriptions from its specs and save
 * them. Admin-gated. Fail-open (templated copy when the LLM is off).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: car, error } = await supabase
    .from("cars")
    .select("brand, model, year, body_type, fuel_type, transmission, engine_volume, engine_power, color")
    .eq("id", id)
    .single();

  if (error || !car) return NextResponse.json({ error: "Car not found" }, { status: 404 });

  const copy = await generateCarCopy(car);

  const { error: updErr } = await supabase
    .from("cars")
    .update({
      description_ru: copy.description_ru,
      description_uz: copy.description_uz,
      description_en: copy.description_en,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  logAdminAction(request, {
    action: "update",
    entity: "car",
    entity_id: id,
    diff: { generated_copy: true, ai: copy.ai },
  }).catch(() => {});

  return NextResponse.json({ success: true, ai: copy.ai, copy });
}
