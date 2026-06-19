import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { sendDealerDigest } from "@/lib/cron/dealer-digest";
import { reportServerError, logEvent } from "@/lib/error-report";
import { gatherOperatorContext } from "@/lib/operator-data";
import { generateOperatorBriefing } from "@/lib/operator";

/**
 * Deliver the AI Operator's morning briefing to the dealer (Telegram + email).
 * Fired daily by the cron Worker. Fail-open.
 */
async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const supabase = createServiceClient();
    const context = await gatherOperatorContext(supabase);
    const { text, ai } = await generateOperatorBriefing(context, "ru");

    // Live counts → actionable buttons that deep-link into the in-chat CRM
    // (works because the digest lands in the operator chat). edit-in-place.
    const [leads, tasksOpen, ordersActive] = await Promise.all([
      supabase.from("inquiries").select("id", { count: "exact", head: true }).in("status", ["new", "contacted", "in_progress"]),
      supabase.from("crm_tasks").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("orders").select("id", { count: "exact", head: true }).neq("status", "delivered"),
    ]);
    const telegramButtons = [
      [
        { text: `📥 Заявки (${leads.count ?? 0})`, callback_data: "crm|leads|0" },
        { text: `✅ Задачи (${tasksOpen.count ?? 0})`, callback_data: "crm|tasks|0" },
      ],
      [
        { text: `📦 Заказы (${ordersActive.count ?? 0})`, callback_data: "crm|orders|0" },
        { text: "🗂 CRM", callback_data: "crm|home" },
      ],
    ];
    await sendDealerDigest("☀️ Tez Motors — briefing", text.split("\n"), { telegramButtons });
    logEvent("cron.operator_briefing", { ai });
    return NextResponse.json({ ok: true, ai });
  } catch (error) {
    reportServerError("GET /api/cron/operator-briefing", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
