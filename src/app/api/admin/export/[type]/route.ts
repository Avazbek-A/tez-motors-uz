import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { buildCsv } from "@/lib/csv";
import { logAdminAction } from "@/lib/audit";

/**
 * CSV exports for the dealer / their accountant. Admin-gated, audited.
 * Types: leads | expenses | invoices | inventory.
 */
const MAX = 10000;
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

export async function GET(request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { type } = await params;
  const supabase = createServiceClient();
  let headers: string[] = [];
  let rows: Record<string, unknown>[] = [];

  if (type === "leads") {
    headers = ["created_at", "name", "phone", "email", "type", "status", "source_page"];
    const { data } = await supabase.from("inquiries").select("created_at, name, phone, email, type, status, source_page").order("created_at", { ascending: false }).limit(MAX);
    rows = (data || []) as Record<string, unknown>[];
  } else if (type === "expenses") {
    headers = ["spent_on", "category", "description", "amount", "currency", "amount_usd", "supplier"];
    const { data } = await supabase.from("expenses").select("spent_on, category, description, amount, currency, amount_usd, supplier").order("spent_on", { ascending: false }).limit(MAX);
    rows = (data || []) as Record<string, unknown>[];
  } else if (type === "invoices") {
    headers = ["number", "issued_at", "customer_name", "customer_phone", "subtotal_usd", "vat_usd", "total_usd", "status"];
    const { data } = await supabase.from("invoices").select("number, issued_at, customer_name, customer_phone, subtotal_usd, vat_usd, total_usd, status").order("issued_at", { ascending: false }).limit(MAX);
    rows = (data || []) as Record<string, unknown>[];
  } else if (type === "inventory") {
    headers = ["brand", "model", "year", "inventory_status", "price_usd", "cost_usd", "margin_usd"];
    const [{ data: cars }, { data: costs }] = await Promise.all([
      supabase.from("cars").select("id, brand, model, year, price_usd, inventory_status").limit(MAX),
      supabase.from("car_costs").select("car_id, cost_usd").limit(MAX),
    ]);
    const costByCar = new Map<string, number>();
    for (const c of costs || []) costByCar.set(c.car_id as string, num(c.cost_usd));
    rows = (cars || []).map((c) => {
      const cost = costByCar.get(c.id as string);
      const price = num(c.price_usd);
      return {
        brand: c.brand, model: c.model, year: c.year, inventory_status: c.inventory_status,
        price_usd: price, cost_usd: cost ?? "", margin_usd: cost != null ? price - cost : "",
      };
    });
  } else {
    return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
  }

  const csv = "﻿" + buildCsv(headers, rows); // BOM → Excel reads UTF-8 (Cyrillic) correctly
  const date = new Date().toISOString().slice(0, 10);
  logAdminAction(request, { action: "export", entity: "export", diff: { type, rows: rows.length } }).catch(() => {});

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tezmotors-${type}-${date}.csv"`,
    },
  });
}
