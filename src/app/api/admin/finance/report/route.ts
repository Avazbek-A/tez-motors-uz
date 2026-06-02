import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getFxRates } from "@/lib/fx-rate";

/**
 * Financial report for a period: revenue (paid invoices), VAT collected,
 * outstanding receivables, expenses by category, and gross profit. All in USD;
 * the UI shows so'm via the FX rate. Read-only, admin-gated.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const sp = new URL(request.url).searchParams;
  const now = new Date();
  const defFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const from = sp.get("from") || defFrom;
  const to = sp.get("to") || now.toISOString().slice(0, 10);
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

  try {
    const supabase = createServiceClient();
    const [invRes, expRes, fx] = await Promise.all([
      supabase.from("invoices").select("status, subtotal_usd, vat_usd, total_usd, issued_at").gte("issued_at", from).lte("issued_at", to).limit(5000),
      supabase.from("expenses").select("category, amount_usd, spent_on").gte("spent_on", from).lte("spent_on", to).limit(5000),
      getFxRates(supabase),
    ]);

    const invoices = invRes.data || [];
    const paid = invoices.filter((i) => i.status === "paid");
    const sent = invoices.filter((i) => i.status === "sent");

    const revenueUsd = Math.round(paid.reduce((a, i) => a + num(i.total_usd), 0));
    const vatCollectedUsd = Math.round(paid.reduce((a, i) => a + num(i.vat_usd), 0));
    const outstandingUsd = Math.round(sent.reduce((a, i) => a + num(i.total_usd), 0));

    const byCategory: Record<string, number> = {};
    let expensesUsd = 0;
    for (const e of expRes.data || []) {
      const v = num(e.amount_usd);
      expensesUsd += v;
      byCategory[e.category as string] = (byCategory[e.category as string] || 0) + v;
    }
    expensesUsd = Math.round(expensesUsd);
    for (const k of Object.keys(byCategory)) byCategory[k] = Math.round(byCategory[k]);

    return NextResponse.json({
      ok: true,
      period: { from, to },
      fx,
      revenueUsd,
      vatCollectedUsd,
      outstandingUsd,
      expensesUsd,
      supplierPaymentsUsd: byCategory["supplier_payment"] || 0,
      grossProfitUsd: revenueUsd - expensesUsd,
      expensesByCategory: byCategory,
      counts: { paidInvoices: paid.length, sentInvoices: sent.length, expenses: (expRes.data || []).length },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to compute finance report" }, { status: 500 });
  }
}
