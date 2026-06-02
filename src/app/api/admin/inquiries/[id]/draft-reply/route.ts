import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { draftLeadReply } from "@/lib/sales-ai";

/**
 * Proactive AI sales: draft a personalized reply to a lead. The dealer reviews
 * it and sends in one tap (WhatsApp). Grounded + fail-open (templated fallback
 * when the LLM is unconfigured). Admin-gated; read-only (writes nothing).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: inquiry, error } = await supabase
    .from("inquiries")
    .select("name, message, type, car_id, metadata")
    .eq("id", id)
    .single();

  if (error || !inquiry) {
    return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  }

  let carName: string | null = null;
  if (inquiry.car_id) {
    const { data: car } = await supabase
      .from("cars")
      .select("brand, model, year")
      .eq("id", inquiry.car_id)
      .single();
    if (car) carName = `${car.brand} ${car.model}${car.year ? ` ${car.year}` : ""}`.trim();
  }

  const meta = (inquiry.metadata || {}) as Record<string, unknown>;
  const locale = typeof meta.locale === "string" ? meta.locale : "ru";

  const { text, ai } = await draftLeadReply({
    locale,
    name: inquiry.name as string,
    message: (inquiry.message as string) ?? null,
    type: (inquiry.type as string) ?? null,
    carName,
  });

  return NextResponse.json({ reply: text, ai });
}
