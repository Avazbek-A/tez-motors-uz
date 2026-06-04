import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getFxRates } from "@/lib/fx-rate";
import { logAdminAction } from "@/lib/audit";
import { normalizeExpenseToUsd, EXPENSE_CATEGORIES } from "@/lib/finance-docs";

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const supabase = createServiceClient();
  const { data, error } = await supabase.from("expenses").select("*").order("spent_on", { ascending: false }).limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expenses: data ?? [] });
}

const createSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().max(300).optional().nullable(),
  amount: z.number().min(0).max(1_000_000_000_000),
  currency: z.enum(["USD", "UZS", "CNY"]),
  supplier: z.string().max(200).optional().nullable(),
  purchase_order_id: z.string().uuid().optional().nullable(),
  shipment_id: z.string().uuid().optional().nullable(),
  spent_on: z.string().max(20).optional().nullable(),
  // Channel tag for marketing spend → feeds per-channel CPA/ROAS (Phase AN).
  channel: z.enum(["olx", "avtoelon", "google", "meta", "telegram", "instagram", "facebook", "other"]).optional().nullable(),
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
  const fx = await getFxRates(supabase);
  const amountUsd = normalizeExpenseToUsd(parsed.data.amount, parsed.data.currency, fx);

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      category: parsed.data.category,
      description: parsed.data.description ?? null,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      amount_usd: amountUsd,
      supplier: parsed.data.supplier ?? null,
      purchase_order_id: parsed.data.purchase_order_id ?? null,
      shipment_id: parsed.data.shipment_id ?? null,
      spent_on: parsed.data.spent_on ?? null,
      channel: parsed.data.channel ?? null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAdminAction(request, { action: "create", entity: "expense", entity_id: data?.id, diff: { category: parsed.data.category, amount_usd: amountUsd } }).catch(() => {});
  return NextResponse.json({ success: true, id: data?.id, amount_usd: amountUsd }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const supabase = createServiceClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  logAdminAction(request, { action: "delete", entity: "expense", entity_id: id }).catch(() => {});
  return NextResponse.json({ success: true });
}
