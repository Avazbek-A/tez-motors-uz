import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { sendChannelMessage } from "@/lib/telegram";
import { logAdminAction } from "@/lib/audit";

/** Publish a marketing post to the Telegram channel. Fail-open: if the channel
 *  isn't configured, returns ok:false with a clear flag (no error thrown). */
const schema = z.object({
  text: z.string().min(1).max(4000),
  link_url: z.string().url().max(1000).optional().nullable(),
  draft_id: z.string().uuid().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const { ok } = await sendChannelMessage(parsed.data.text, { linkUrl: parsed.data.link_url || undefined });

  if (ok && parsed.data.draft_id) {
    const supabase = createServiceClient();
    await supabase
      .from("content_drafts")
      .update({ status: "published", published_channel: "telegram", published_at: new Date().toISOString() })
      .eq("id", parsed.data.draft_id)
      .then(() => {}, () => {});
  }

  logAdminAction(request, { action: "update", entity: "content_publish", diff: { channel: "telegram", ok } }).catch(() => {});
  return NextResponse.json({ ok, channel: "telegram", reason: ok ? undefined : "Telegram channel not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID)" });
}
