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
    await sendDealerDigest("☀️ Tez Motors — briefing", text.split("\n"));
    logEvent("cron.operator_briefing", { ai });
    return NextResponse.json({ ok: true, ai });
  } catch (error) {
    reportServerError("GET /api/cron/operator-briefing", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
