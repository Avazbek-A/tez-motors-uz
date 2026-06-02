import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getUsdUzsRate } from "@/lib/fx-rate";
import { SITE_CONFIG } from "@/lib/constants";

/**
 * A standalone, print-ready HTML invoice (full Unicode — Cyrillic/Uzbek render
 * correctly, unlike the ASCII PDF builder). The dealer opens it and uses the
 * browser's Print → Save as PDF. Admin-gated.
 */
const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const usd = (n: number) => "$" + Math.round(Number(n) || 0).toLocaleString("en-US");

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { id } = await params;
  const supabase = createServiceClient();
  const [{ data: inv }, rate] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).maybeSingle(),
    getUsdUzsRate(supabase),
  ]);
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = (Array.isArray(inv.line_items) ? inv.line_items : []) as { description: string; qty: number; unitUsd: number }[];
  const rows = items
    .map(
      (it) => `<tr>
        <td>${esc(it.description)}</td>
        <td class="r">${esc(it.qty)}</td>
        <td class="r">${usd(it.unitUsd)}</td>
        <td class="r">${usd((Number(it.qty) || 0) * (Number(it.unitUsd) || 0))}</td>
      </tr>`,
    )
    .join("");
  const uzsTotal = rate > 0 ? Math.round(Number(inv.total_usd) * rate).toLocaleString("ru-RU") : null;

  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Инвойс ${esc(inv.number)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111; margin: 0; padding: 32px; }
  .sheet { max-width: 800px; margin: 0 auto; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 16px; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: .5px; }
  .muted { color: #666; font-size: 13px; }
  h1 { font-size: 18px; margin: 24px 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #ddd; }
  th { background: #f5f5f5; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }
  .r { text-align: right; }
  .totals { margin-top: 12px; margin-left: auto; width: 280px; font-size: 14px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { border-top: 2px solid #111; font-weight: 800; font-size: 16px; padding-top: 8px; }
  .meta { display: flex; gap: 48px; margin-top: 20px; font-size: 14px; }
  .notes { margin-top: 24px; font-size: 13px; color: #444; white-space: pre-wrap; }
  .footer { margin-top: 40px; font-size: 12px; color: #888; border-top: 1px solid #ddd; padding-top: 12px; }
  .status { display:inline-block; font-size:11px; text-transform:uppercase; letter-spacing:.5px; padding:2px 8px; border:1px solid #111; border-radius:2px; }
  .print-btn { position: fixed; top: 16px; right: 16px; padding: 10px 16px; background: #111; color: #fff; border: 0; border-radius: 6px; cursor: pointer; font-size: 14px; }
  @media print { .print-btn { display: none; } body { padding: 0; } }
</style></head>
<body>
  <button class="print-btn" onclick="window.print()">Печать / Сохранить PDF</button>
  <div class="sheet">
    <div class="top">
      <div>
        <div class="brand">${esc(SITE_CONFIG.name)}</div>
        <div class="muted">${esc(SITE_CONFIG.url)}<br>${esc(SITE_CONFIG.phone)}</div>
      </div>
      <div style="text-align:right">
        <h1 style="margin:0">ИНВОЙС</h1>
        <div class="muted">№ ${esc(inv.number)}</div>
        <div class="muted">${esc(inv.issued_at)}</div>
        <div style="margin-top:6px"><span class="status">${esc(inv.status)}</span></div>
      </div>
    </div>

    <div class="meta">
      <div>
        <div class="muted">Заказчик</div>
        <div><strong>${esc(inv.customer_name)}</strong></div>
        <div class="muted">${esc(inv.customer_phone || "")}</div>
      </div>
      ${inv.due_at ? `<div><div class="muted">Срок оплаты</div><div>${esc(inv.due_at)}</div></div>` : ""}
    </div>

    <table>
      <thead><tr><th>Описание</th><th class="r">Кол-во</th><th class="r">Цена</th><th class="r">Сумма</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4" class="muted">—</td></tr>`}</tbody>
    </table>

    <div class="totals">
      <div><span>Подытог</span><span>${usd(inv.subtotal_usd)}</span></div>
      <div><span>НДС (${esc(inv.vat_pct)}%)</span><span>${usd(inv.vat_usd)}</span></div>
      <div class="grand"><span>Итого</span><span>${usd(inv.total_usd)}</span></div>
      ${uzsTotal ? `<div class="muted" style="justify-content:flex-end">≈ ${uzsTotal} сум</div>` : ""}
    </div>

    ${inv.notes ? `<div class="notes"><strong>Примечание:</strong>\n${esc(inv.notes)}</div>` : ""}

    <div class="footer">${esc(SITE_CONFIG.name)} — импорт автомобилей под ключ. Спасибо за доверие.</div>
  </div>
</body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
