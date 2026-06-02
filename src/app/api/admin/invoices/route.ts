import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { computeInvoiceTotals } from "@/lib/finance-docs";

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const status = new URL(request.url).searchParams.get("status");
  const supabase = createServiceClient();
  let query = supabase.from("invoices").select("*").order("issued_at", { ascending: false }).order("created_at", { ascending: false }).limit(500);
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoices: data ?? [] });
}

const lineSchema = z.object({ description: z.string().max(200), qty: z.number().min(0).max(100000), unitUsd: z.number().min(0).max(100_000_000) });
const createSchema = z.object({
  customer_name: z.string().min(1).max(160),
  customer_phone: z.string().max(30).optional().nullable(),
  order_id: z.string().uuid().optional().nullable(),
  line_items: z.array(lineSchema).min(1).max(50),
  vat_pct: z.number().min(0).max(100).optional(),
  due_at: z.string().max(20).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

function genNumber(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const buf = new Uint8Array(2);
  crypto.getRandomValues(buf);
  const suffix = Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `INV-${ymd}-${suffix}`;
}

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

  const vatPct = parsed.data.vat_pct ?? 12;
  const totals = computeInvoiceTotals(parsed.data.line_items, vatPct);

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      number: genNumber(),
      customer_name: parsed.data.customer_name,
      customer_phone: parsed.data.customer_phone ?? null,
      order_id: parsed.data.order_id ?? null,
      line_items: parsed.data.line_items,
      subtotal_usd: totals.subtotalUsd,
      vat_pct: vatPct,
      vat_usd: totals.vatUsd,
      total_usd: totals.totalUsd,
      due_at: parsed.data.due_at ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id, number")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAdminAction(request, { action: "create", entity: "invoice", entity_id: data?.id, diff: { number: data?.number, total_usd: totals.totalUsd } }).catch(() => {});
  return NextResponse.json({ success: true, id: data?.id, number: data?.number }, { status: 201 });
}
