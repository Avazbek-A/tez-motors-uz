import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { attributionLabel, type Attribution } from "@/lib/attribution";
import { contactKey } from "@/lib/crm";

/**
 * Marketing attribution report: leads grouped by acquisition source/campaign
 * (from the inquiry's stored UTM/referrer), with conversion = the lead's phone
 * later appearing on an order. Shows which channels actually drive sales.
 * Read-only, admin-gated.
 */
const MAX = 5000;

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();
    const [inqRes, ordRes] = await Promise.all([
      supabase.from("inquiries").select("phone, metadata, created_at").limit(MAX),
      supabase.from("orders").select("customer_phone").limit(MAX),
    ]);

    const orderPhones = new Set<string>();
    for (const o of ordRes.data || []) {
      const k = contactKey(o.customer_phone as string);
      if (k) orderPhones.add(k);
    }

    interface Bucket { leads: number; phones: Set<string> }
    const bySource = new Map<string, Bucket>();
    const byCampaign = new Map<string, Bucket>();
    const byReferral = new Map<string, Bucket>();
    const add = (map: Map<string, Bucket>, key: string, phone: string | null) => {
      const b = map.get(key) || { leads: 0, phones: new Set<string>() };
      b.leads += 1;
      const ck = contactKey(phone);
      if (ck) b.phones.add(ck);
      map.set(key, b);
    };

    for (const i of inqRes.data || []) {
      const attr = ((i.metadata as { attribution?: Attribution } | null)?.attribution) || null;
      add(bySource, attributionLabel(attr), i.phone as string);
      if (attr?.campaign) add(byCampaign, attr.campaign.toLowerCase(), i.phone as string);
      if (attr?.ref) add(byReferral, attr.ref.toLowerCase(), i.phone as string);
    }

    const toRows = (map: Map<string, Bucket>) =>
      Array.from(map.entries())
        .map(([key, b]) => {
          const conversions = Array.from(b.phones).filter((p) => orderPhones.has(p)).length;
          return { key, leads: b.leads, conversions, convRate: b.leads > 0 ? Math.round((conversions / b.leads) * 1000) / 10 : 0 };
        })
        .sort((a, b) => b.leads - a.leads);

    return NextResponse.json({
      ok: true,
      totalLeads: (inqRes.data || []).length,
      bySource: toRows(bySource),
      byCampaign: toRows(byCampaign).slice(0, 20),
      byReferral: toRows(byReferral).slice(0, 50),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to compute attribution" }, { status: 500 });
  }
}
