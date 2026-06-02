import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getUsdUzsRate } from "@/lib/fx-rate";
import { contactKey, pickFirst, tiyinToUzs, uzsToUsd, latest, earliest } from "@/lib/crm";

/**
 * Customer 360 — list. Stitches scattered records (inquiries, orders, AI
 * conversations, accounts) into one contact per person, keyed by the 9-digit
 * phone core, with per-contact counts, lead score, deposits, and activity
 * bounds. Read-only, admin-gated, service-role.
 */
const MAX = 5000;

interface Contact {
  key: string;
  phone: string;
  name: string | null;
  email: string | null;
  sources: Set<string>;
  inquiries: number;
  orders: number;
  conversations: number;
  hasAccount: boolean;
  leadScore: number;
  firstSeen: string[];
  lastSeen: string[];
  depositsUzs: number;
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const q = (new URL(request.url).searchParams.get("q") || "").trim().toLowerCase();

  try {
    const supabase = createServiceClient();
    const [inqRes, ordRes, convRes, custRes, payRes] = await Promise.all([
      supabase.from("inquiries").select("phone, name, email, status, created_at").limit(MAX),
      supabase.from("orders").select("id, customer_phone, customer_name, customer_email, status, created_at").limit(MAX),
      supabase.from("assistant_conversations").select("phone, name, lead_score, last_message_at").not("phone", "is", null).limit(MAX),
      supabase.from("customers").select("phone, name, email, created_at, last_login_at").limit(MAX),
      supabase.from("payments").select("order_id, amount_tiyin, state").eq("state", 2).limit(MAX),
    ]);

    const map = new Map<string, Contact>();
    const get = (rawPhone: string | null | undefined): Contact | null => {
      const key = contactKey(rawPhone);
      if (!key) return null;
      let c = map.get(key);
      if (!c) {
        c = {
          key,
          phone: (rawPhone || "").trim() || `+998${key}`,
          name: null,
          email: null,
          sources: new Set(),
          inquiries: 0,
          orders: 0,
          conversations: 0,
          hasAccount: false,
          leadScore: 0,
          firstSeen: [],
          lastSeen: [],
          depositsUzs: 0,
        };
        map.set(key, c);
      }
      return c;
    };

    for (const r of inqRes.data || []) {
      const c = get(r.phone as string);
      if (!c) continue;
      c.inquiries += 1;
      c.sources.add("inquiry");
      c.name = pickFirst([c.name, r.name as string]);
      c.email = pickFirst([c.email, r.email as string]);
      c.firstSeen.push(r.created_at as string);
      c.lastSeen.push(r.created_at as string);
    }

    const orderKeyById = new Map<string, string>();
    for (const r of ordRes.data || []) {
      const c = get(r.customer_phone as string);
      if (!c) continue;
      orderKeyById.set(r.id as string, c.key);
      c.orders += 1;
      c.sources.add("order");
      c.name = pickFirst([c.name, r.customer_name as string]);
      c.email = pickFirst([c.email, r.customer_email as string]);
      c.firstSeen.push(r.created_at as string);
      c.lastSeen.push(r.created_at as string);
    }

    for (const r of convRes.data || []) {
      const c = get(r.phone as string);
      if (!c) continue;
      c.conversations += 1;
      c.sources.add("conversation");
      c.name = pickFirst([c.name, r.name as string]);
      c.leadScore = Math.max(c.leadScore, Number(r.lead_score) || 0);
      c.lastSeen.push(r.last_message_at as string);
    }

    for (const r of custRes.data || []) {
      const c = get(r.phone as string);
      if (!c) continue;
      c.hasAccount = true;
      c.sources.add("account");
      c.name = pickFirst([c.name, r.name as string]);
      c.email = pickFirst([c.email, r.email as string]);
      c.firstSeen.push(r.created_at as string);
      if (r.last_login_at) c.lastSeen.push(r.last_login_at as string);
    }

    for (const p of payRes.data || []) {
      const key = orderKeyById.get(p.order_id as string);
      if (!key) continue;
      const c = map.get(key);
      if (c) c.depositsUzs += tiyinToUzs(Number(p.amount_tiyin) || 0);
    }

    const rate = await getUsdUzsRate(supabase);
    let rows = Array.from(map.values()).map((c) => ({
      key: c.key,
      phone: c.phone,
      name: c.name,
      email: c.email,
      sources: Array.from(c.sources),
      inquiries: c.inquiries,
      orders: c.orders,
      conversations: c.conversations,
      hasAccount: c.hasAccount,
      leadScore: c.leadScore,
      depositsUzs: c.depositsUzs,
      depositsUsd: uzsToUsd(c.depositsUzs, rate),
      firstSeen: earliest(c.firstSeen),
      lastSeen: latest(c.lastSeen),
    }));

    if (q) {
      rows = rows.filter((r) => (r.name || "").toLowerCase().includes(q) || r.phone.includes(q) || r.key.includes(q));
    }

    rows.sort((a, b) => (b.lastSeen || "").localeCompare(a.lastSeen || ""));

    return NextResponse.json({ ok: true, total: rows.length, customers: rows.slice(0, 200), rate });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to build customer list" }, { status: 500 });
  }
}
