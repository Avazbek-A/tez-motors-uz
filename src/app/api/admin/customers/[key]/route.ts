import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getUsdUzsRate } from "@/lib/fx-rate";
import { pickFirst, sortEventsDesc, tiyinToUzs, uzsToUsd, latest, earliest, type TimelineEvent } from "@/lib/crm";
import { customerTier, daysSince } from "@/lib/crm-insights";

/**
 * Customer 360 — one profile. `key` is the 9-digit phone core, used as an ILIKE
 * needle that matches every stored phone format. Stitches the person's
 * inquiries, orders (+ events + deposits), AI conversations and account into a
 * single merged timeline. Read-only, admin-gated, service-role.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { key } = await params;
  const needle = (key || "").replace(/\D/g, "").slice(-9);
  if (needle.length < 7) return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  const like = `%${needle}%`;

  try {
    const supabase = createServiceClient();
    const [inqRes, ordRes, convRes, custRes] = await Promise.all([
      supabase.from("inquiries").select("id, name, email, phone, status, type, message, car_id, source_page, created_at").ilike("phone", like).order("created_at", { ascending: false }).limit(200),
      supabase.from("orders").select("id, reference_code, status, car_id, amount_usd, customer_name, customer_email, customer_phone, created_at").ilike("customer_phone", like).order("created_at", { ascending: false }).limit(200),
      supabase.from("assistant_conversations").select("thread_id, channel, stage, lead_score, profile, handoff, last_message_at, created_at").ilike("phone", like).order("last_message_at", { ascending: false }).limit(50),
      supabase.from("customers").select("id, name, email, phone, locale, created_at, last_login_at").ilike("phone", like).maybeSingle(),
    ]);

    const inquiries = inqRes.data || [];
    const orders = ordRes.data || [];
    const conversations = convRes.data || [];
    const account = custRes.data || null;

    const orderIds = orders.map((o) => o.id as string);
    const [evRes, payRes, favRes] = await Promise.all([
      orderIds.length ? supabase.from("order_events").select("order_id, status, note, created_at").in("order_id", orderIds).limit(500) : Promise.resolve({ data: [] }),
      orderIds.length ? supabase.from("payments").select("order_id, amount_tiyin, state, created_at").in("order_id", orderIds).eq("state", 2).limit(200) : Promise.resolve({ data: [] }),
      account ? supabase.from("favorites").select("car_id, created_at").eq("customer_id", account.id).limit(100) : Promise.resolve({ data: [] }),
    ]);
    const events = (evRes.data || []) as { order_id: string; status: string; note: string | null; created_at: string }[];
    const payments = (payRes.data || []) as { amount_tiyin: number; created_at: string }[];
    const favorites = (favRes.data || []) as { car_id: string; created_at: string }[];

    // Label cars referenced anywhere.
    const carIds = Array.from(
      new Set(
        [...inquiries.map((i) => i.car_id), ...orders.map((o) => o.car_id), ...favorites.map((f) => f.car_id)].filter(Boolean) as string[],
      ),
    );
    const carName = new Map<string, string>();
    if (carIds.length) {
      const { data: cars } = await supabase.from("cars").select("id, brand, model, year").in("id", carIds);
      for (const c of cars || []) carName.set(c.id as string, `${c.brand} ${c.model}${c.year ? ` ${c.year}` : ""}`);
    }

    const rate = await getUsdUzsRate(supabase);
    const depositsUzs = payments.reduce((a, p) => a + tiyinToUzs(Number(p.amount_tiyin) || 0), 0);

    // Build the unified timeline.
    const timeline: TimelineEvent[] = [];
    for (const i of inquiries) {
      timeline.push({
        type: "inquiry",
        title: `Inquiry · ${i.type || "general"}`,
        detail: [i.car_id ? carName.get(i.car_id as string) : null, (i.message as string) || null].filter(Boolean).join(" — ").slice(0, 160) || undefined,
        at: i.created_at as string,
        link: "/admin/inquiries",
      });
    }
    for (const o of orders) {
      timeline.push({
        type: "order",
        title: `Order ${o.reference_code} created`,
        detail: [o.car_id ? carName.get(o.car_id as string) : null, `status: ${o.status}`].filter(Boolean).join(" — "),
        at: o.created_at as string,
        link: "/admin/orders",
      });
    }
    for (const e of events) {
      timeline.push({ type: "order_event", title: `Order → ${e.status.replace("_", " ")}`, detail: e.note || undefined, at: e.created_at });
    }
    for (const p of payments) {
      timeline.push({ type: "payment", title: "Deposit paid", detail: `${tiyinToUzs(Number(p.amount_tiyin) || 0).toLocaleString("ru-RU")} so'm`, at: p.created_at });
    }
    for (const c of conversations) {
      timeline.push({
        type: "conversation",
        title: `AI chat (${c.channel}) · ${c.stage}`,
        detail: `score ${c.lead_score}${c.handoff ? " · handoff" : ""}`,
        at: (c.last_message_at as string) || (c.created_at as string),
        link: "/admin/conversations",
      });
    }
    if (account) {
      timeline.push({ type: "account", title: "Account created", at: account.created_at as string });
    }

    const allDates = timeline.map((e) => e.at);
    const maxLeadScore = conversations.reduce((m, c) => Math.max(m, Number(c.lead_score) || 0), 0);
    const lastSeen = latest(allDates);
    const depositsUsd = uzsToUsd(depositsUzs, rate);
    const tier = customerTier({
      ordersCount: orders.length,
      depositsUsd,
      lastSeenDaysAgo: daysSince(lastSeen, Date.now()),
      leadScore: maxLeadScore,
    });

    return NextResponse.json({
      ok: true,
      profile: {
        key: needle,
        phone: pickFirst([account?.phone as string, orders[0]?.customer_phone as string, inquiries[0]?.phone as string]) || `+998${needle}`,
        name: pickFirst([account?.name as string, ...orders.map((o) => o.customer_name as string), ...inquiries.map((i) => i.name as string)]),
        email: pickFirst([account?.email as string, ...orders.map((o) => o.customer_email as string), ...inquiries.map((i) => i.email as string)]),
        hasAccount: !!account,
        locale: account?.locale || null,
        leadScore: maxLeadScore,
        tier,
        stats: {
          inquiries: inquiries.length,
          orders: orders.length,
          conversations: conversations.length,
          favorites: favorites.length,
          depositsUzs,
          depositsUsd: uzsToUsd(depositsUzs, rate),
          firstSeen: earliest(allDates),
          lastSeen: latest(allDates),
        },
      },
      timeline: sortEventsDesc(timeline),
      inquiries,
      orders,
      conversations,
      favorites: favorites.map((f) => ({ car_id: f.car_id, name: carName.get(f.car_id) || f.car_id, created_at: f.created_at })),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to build customer profile" }, { status: 500 });
  }
}
