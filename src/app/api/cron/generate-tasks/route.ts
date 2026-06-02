import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { reportServerError, logEvent } from "@/lib/error-report";
import { contactKey } from "@/lib/crm";

/**
 * Auto-generate sales tasks from signals that need a human touch:
 *   - stale new leads (inquiry 'new' > 2 days old)
 *   - due follow-ups (inquiry follow_up_date <= today, not closed)
 *   - abandoned deposits (order still 'ordered' > 1 day, deposit not paid)
 *   - hot AI handoffs (conversation flagged handoff, last 7 days)
 * Idempotent: each task carries an auto_source unique key, so re-runs upsert-
 * ignore duplicates. Fired daily by the cron Worker.
 */
interface TaskRow {
  title: string;
  kind: string;
  customer_key: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  inquiry_id?: string | null;
  order_id?: string | null;
  thread_id?: string | null;
  due_at: string | null;
  auto_source: string;
}

async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const supabase = createServiceClient();
    const now = new Date();
    const nowIso = now.toISOString();
    const today = nowIso.slice(0, 10);
    const twoDaysAgo = new Date(now.getTime() - 2 * 86_400_000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 86_400_000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();

    const rows: TaskRow[] = [];

    // 1) Stale new leads
    const { data: stale } = await supabase
      .from("inquiries")
      .select("id, name, phone, type, created_at")
      .eq("status", "new")
      .lt("created_at", twoDaysAgo)
      .order("created_at", { ascending: true })
      .limit(100);
    for (const i of stale || []) {
      rows.push({
        title: `Follow up: ${i.name} (${i.type || "lead"})`,
        kind: "stale_lead",
        customer_key: contactKey(i.phone as string),
        customer_phone: i.phone as string,
        customer_name: i.name as string,
        inquiry_id: i.id as string,
        due_at: nowIso,
        auto_source: `stale_lead:${i.id}`,
      });
    }

    // 2) Due follow-ups
    const { data: due } = await supabase
      .from("inquiries")
      .select("id, name, phone, type, follow_up_date")
      .not("follow_up_date", "is", null)
      .lte("follow_up_date", today)
      .neq("status", "closed")
      .limit(100);
    for (const i of due || []) {
      rows.push({
        title: `Follow-up due: ${i.name}`,
        kind: "follow_up",
        customer_key: contactKey(i.phone as string),
        customer_phone: i.phone as string,
        customer_name: i.name as string,
        inquiry_id: i.id as string,
        due_at: `${i.follow_up_date}T09:00:00Z`,
        auto_source: `followup:${i.id}:${i.follow_up_date}`,
      });
    }

    // 3) Abandoned deposits (reserved but never paid)
    const { data: abandoned } = await supabase
      .from("orders")
      .select("id, reference_code, customer_name, customer_phone, created_at")
      .eq("status", "ordered")
      .lt("created_at", oneDayAgo)
      .limit(100);
    for (const o of abandoned || []) {
      rows.push({
        title: `Chase deposit: order ${o.reference_code} (${o.customer_name})`,
        kind: "abandoned_deposit",
        customer_key: contactKey(o.customer_phone as string),
        customer_phone: o.customer_phone as string,
        customer_name: o.customer_name as string,
        order_id: o.id as string,
        due_at: nowIso,
        auto_source: `abandoned:${o.id}`,
      });
    }

    // 4) Hot AI handoffs
    const { data: handoffs } = await supabase
      .from("assistant_conversations")
      .select("thread_id, name, phone, lead_score, last_message_at")
      .eq("handoff", true)
      .not("phone", "is", null)
      .gte("last_message_at", sevenDaysAgo)
      .limit(100);
    for (const c of handoffs || []) {
      rows.push({
        title: `Call hot lead: ${c.name || c.phone} (score ${c.lead_score})`,
        kind: "handoff",
        customer_key: contactKey(c.phone as string),
        customer_phone: c.phone as string,
        customer_name: (c.name as string) || null,
        thread_id: c.thread_id as string,
        due_at: nowIso,
        auto_source: `handoff:${c.thread_id}`,
      });
    }

    let created = 0;
    if (rows.length > 0) {
      const { error, count } = await supabase
        .from("crm_tasks")
        .upsert(rows, { onConflict: "auto_source", ignoreDuplicates: true, count: "exact" });
      if (error) {
        reportServerError("cron/generate-tasks upsert", error).catch(() => {});
      } else {
        created = count ?? 0;
      }
    }

    logEvent("cron.generate_tasks", { candidates: rows.length, created });
    return NextResponse.json({ ok: true, candidates: rows.length, created });
  } catch (error) {
    reportServerError("GET /api/cron/generate-tasks", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
