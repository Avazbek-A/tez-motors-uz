import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { sendChannelMessage } from "@/lib/telegram";
import { reportServerError, logEvent } from "@/lib/error-report";

/**
 * Publish scheduled marketing posts whose time has come to the Telegram
 * channel. Per-run cap so a backlog can't storm the channel. Fired hourly by
 * the cron Worker. Fail-open.
 */
const PER_RUN_CAP = 5;
const SOCIAL = ["telegram", "instagram", "facebook", "promo", "ad"];

async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const supabase = createServiceClient();
    const nowIso = new Date().toISOString();

    const { data: due } = await supabase
      .from("content_drafts")
      .select("id, body, kind")
      .eq("status", "draft")
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", nowIso)
      .in("kind", SOCIAL)
      .order("scheduled_at", { ascending: true })
      .limit(PER_RUN_CAP);

    let posted = 0;
    for (const d of due || []) {
      const { ok } = await sendChannelMessage(d.body as string);
      if (ok) {
        await supabase
          .from("content_drafts")
          .update({ status: "published", published_channel: "telegram", published_at: new Date().toISOString() })
          .eq("id", d.id)
          .then(() => {}, () => {});
        posted += 1;
      } else {
        // Channel not configured / failed — stop trying this run.
        break;
      }
    }

    logEvent("cron.marketing_poster", { due: (due || []).length, posted });
    return NextResponse.json({ ok: true, due: (due || []).length, posted });
  } catch (error) {
    reportServerError("GET /api/cron/marketing-poster", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
