import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { channelKey, type Attribution } from "@/lib/attribution";
import { getFxRates } from "@/lib/fx-rate";
import { contactKey } from "@/lib/crm";

/**
 * Channel ROI (Phase AN) — closes the loop distribution opened: per acquisition
 * channel, leads → orders → deposits → realized margin, against ad spend, with
 * CPA and ROAS. Order attribution is read from orders.attribution (stamped at
 * creation) with a phone-match fallback to the originating lead. Read-only,
 * admin-gated.
 */
const MAX = 5000;
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

interface Row {
  channel: string;
  leads: number;
  orders: number;
  depositsUsd: number;
  marginUsd: number;
  spendUsd: number;
  cpaUsd: number | null;
  roas: number | null;
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();
    const [inqRes, ordRes, payRes, costRes, carRes, expRes, fx] = await Promise.all([
      supabase.from("inquiries").select("phone, metadata").limit(MAX),
      supabase.from("orders").select("id, customer_phone, attribution, car_id, status").limit(MAX),
      // Paginate the deposit rows so the per-channel deposit sum doesn't undercount past the cap.
      fetchAllRows<{ order_id: string; amount_tiyin: number; state: number }>((from, to) =>
        supabase.from("payments").select("order_id, amount_tiyin, state").eq("state", 2).range(from, to),
      ).then((data) => ({ data })),
      supabase.from("car_costs").select("car_id, cost_usd").limit(MAX),
      supabase.from("cars").select("id, price_usd").limit(MAX),
      supabase.from("expenses").select("category, channel, amount_usd").eq("category", "marketing").limit(MAX),
      getFxRates(supabase),
    ]);

    // Lead attribution by phone (fallback for orders without stamped attribution).
    const leadChannelByPhone = new Map<string, string>();
    const leadRows = new Map<string, number>();
    for (const i of inqRes.data || []) {
      const attr = ((i.metadata as { attribution?: Attribution } | null)?.attribution) || null;
      const ch = channelKey(attr);
      leadRows.set(ch, (leadRows.get(ch) || 0) + 1);
      const k = contactKey(i.phone as string);
      if (k && !leadChannelByPhone.has(k)) leadChannelByPhone.set(k, ch);
    }

    const costByCar = new Map<string, number>();
    for (const c of costRes.data || []) costByCar.set(c.car_id as string, num(c.cost_usd));
    const priceByCar = new Map<string, number>();
    for (const c of carRes.data || []) priceByCar.set(c.id as string, num(c.price_usd));

    const depositTiyinByOrder = new Map<string, number>();
    for (const p of payRes.data || []) {
      const id = p.order_id as string;
      depositTiyinByOrder.set(id, (depositTiyinByOrder.get(id) || 0) + num(p.amount_tiyin));
    }

    const rows = new Map<string, Row>();
    const bump = (ch: string): Row => {
      let r = rows.get(ch);
      if (!r) {
        r = { channel: ch, leads: 0, orders: 0, depositsUsd: 0, marginUsd: 0, spendUsd: 0, cpaUsd: null, roas: null };
        rows.set(ch, r);
      }
      return r;
    };
    for (const [ch, n] of leadRows) bump(ch).leads = n;

    const usdUzs = fx.usd_uzs > 0 ? fx.usd_uzs : 12600;
    for (const o of ordRes.data || []) {
      const stamped = (o.attribution as Attribution | null) ?? null;
      const ch = stamped
        ? channelKey(stamped)
        : leadChannelByPhone.get(contactKey(o.customer_phone as string) || "") || "direct";
      const r = bump(ch);
      r.orders += 1;
      const depositTiyin = depositTiyinByOrder.get(o.id as string) || 0;
      r.depositsUsd += depositTiyin / 100 / usdUzs;
      // Realized margin only counts when the deal is sold/delivered with a known cost.
      const cost = o.car_id ? costByCar.get(o.car_id as string) : undefined;
      const price = o.car_id ? priceByCar.get(o.car_id as string) : undefined;
      if (cost != null && price != null && o.status === "delivered") r.marginUsd += price - cost;
    }

    // Ad spend by channel.
    for (const e of expRes.data || []) {
      const ch = (e.channel as string) || "other";
      bump(ch).spendUsd += num(e.amount_usd);
    }

    const out = Array.from(rows.values()).map((r) => {
      r.depositsUsd = Math.round(r.depositsUsd);
      r.marginUsd = Math.round(r.marginUsd);
      r.spendUsd = Math.round(r.spendUsd);
      r.cpaUsd = r.spendUsd > 0 && r.orders > 0 ? Math.round(r.spendUsd / r.orders) : null;
      // ROAS against realized margin (true profit), not gross deposits.
      r.roas = r.spendUsd > 0 ? Math.round((r.marginUsd / r.spendUsd) * 100) / 100 : null;
      return r;
    });
    out.sort((a, b) => b.marginUsd - a.marginUsd || b.orders - a.orders || b.leads - a.leads);

    return NextResponse.json({ ok: true, channels: out });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to compute channel ROI" }, { status: 500 });
  }
}
