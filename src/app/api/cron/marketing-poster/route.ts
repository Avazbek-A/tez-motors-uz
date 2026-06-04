import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { sendChannelMessage, sendChannelPhoto } from "@/lib/telegram";
import { metaConfigured, postToFacebook, postToInstagram } from "@/lib/meta-publish";
import { reportServerError, logEvent } from "@/lib/error-report";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://tezmotors.uz").replace(/\/$/, "");

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
      .select("id, body, kind, car_id")
      .eq("status", "draft")
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", nowIso)
      .in("kind", SOCIAL)
      .order("scheduled_at", { ascending: true })
      .limit(PER_RUN_CAP);

    let posted = 0;
    for (const d of due || []) {
      const body = d.body as string;
      // Car-linked posts get a photo + a "view car" deep link — visual posts
      // convert far better on Telegram. Fall back to text when there's no image
      // or the caption is too long for Telegram's 1024-char photo caption.
      let link: { linkUrl?: string; linkLabel?: string } = {};
      let photoUrl: string | null = null;
      if (d.car_id) {
        const { data: car } = await supabase
          .from("cars")
          .select("slug, images")
          .eq("id", d.car_id)
          .maybeSingle();
        if (car?.slug) link = { linkUrl: `${SITE}/ru/catalog/${car.slug}`, linkLabel: "Открыть" };
        const firstImage = Array.isArray(car?.images) ? car!.images[0] : null;
        if (firstImage && body.length <= 1024) photoUrl = firstImage as string;
      }
      // Route to the platform that matches the draft's kind when Meta is
      // configured; otherwise fall back to the Telegram channel (today's
      // behavior). IG needs an image; FB takes text + link.
      const meta = metaConfigured();
      let ok = false;
      let channel = "telegram";
      if (d.kind === "instagram" && meta.ig && photoUrl) {
        ok = (await postToInstagram(photoUrl, body)).ok;
        channel = "instagram";
      } else if (d.kind === "facebook" && meta.fb) {
        ok = (await postToFacebook(body, link.linkUrl)).ok;
        channel = "facebook";
      }
      if (!ok) {
        // Fall back to the Telegram channel (visual when we have a photo).
        ok = (photoUrl ? await sendChannelPhoto(photoUrl, body, link) : await sendChannelMessage(body, link)).ok;
        channel = "telegram";
      }
      if (ok) {
        await supabase
          .from("content_drafts")
          .update({ status: "published", published_channel: channel, published_at: new Date().toISOString() })
          .eq("id", d.id)
          .then(() => {}, () => {});
        posted += 1;
      } else {
        // No channel succeeded (nothing configured) — stop trying this run.
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
