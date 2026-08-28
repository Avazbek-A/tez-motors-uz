import { NextRequest, NextResponse } from "next/server";
import { assertCron } from "@/lib/cron/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { sendChannelMessage } from "@/lib/telegram";
import { reportServerError, logEvent } from "@/lib/error-report";

/**
 * Apply & end scheduled promotions. Activating snapshots the car's current price
 * into the promo + cars.original_price_usd (storefront strikethrough) and sets
 * the sale price; ending reverts to the snapshot. Also announces new sales to
 * the Telegram channel once. Fired hourly. Idempotent + fail-open.
 */
async function handle(request: NextRequest) {
  const unauth = assertCron(request);
  if (unauth) return unauth;

  try {
    const supabase = createServiceClient();
    const nowIso = new Date().toISOString();
    const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://tezmotors.uz").replace(/\/$/, "");
    let activated = 0;
    let ended = 0;

    // Activate scheduled promos whose start has arrived (or has no start).
    const { data: toActivate } = await supabase
      .from("promotions")
      .select("id, car_id, sale_price_usd, label, announced, starts_at")
      .eq("status", "scheduled")
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .limit(100);

    for (const promo of toActivate || []) {
      const { data: car } = await supabase.from("cars").select("brand, model, year, price_usd, slug").eq("id", promo.car_id).maybeSingle();
      if (!car) continue;
      const pre = Number(car.price_usd) || 0;
      const sale = Number(promo.sale_price_usd) || 0;
      if (sale <= 0 || sale >= pre) {
        await supabase.from("promotions").update({ status: "cancelled" }).eq("id", promo.id).then(() => {}, () => {});
        continue;
      }

      // Announce first so `announced` records whether the channel post actually
      // landed — a Telegram outage leaves it false and the promo is retried on a
      // later run instead of being silently marked announced.
      let announced = Boolean(promo.announced);
      if (!announced) {
        const pct = Math.round((1 - sale / pre) * 100);
        const text = `🔥 Скидка ${pct}%\n\n${car.brand} ${car.model}${car.year ? ` ${car.year}` : ""}\nБыло $${pre.toLocaleString("en-US")} → $${sale.toLocaleString("en-US")}\n\n${promo.label || "Ограниченное предложение от Tez Motors"}`;
        announced = await sendChannelMessage(text, { linkUrl: `${base}/ru/catalog/${car.slug}`, linkLabel: "Смотреть" }).then(() => true, () => false);
      }

      // Flip the promo active and snapshot the pre-promo price FIRST (guarded on
      // status='scheduled' so concurrent/retried runs can't double-activate),
      // THEN apply the sale price to the car. If the worker dies between the two
      // writes the car keeps its ORIGINAL price (storefront shows no discount
      // yet) rather than being stranded at the sale price with no active promo
      // to ever revert it.
      const { data: flipped } = await supabase
        .from("promotions")
        .update({ status: "active", pre_promo_price_usd: pre, announced })
        .eq("id", promo.id)
        .eq("status", "scheduled")
        .select("id");
      if (!flipped || flipped.length === 0) continue; // lost the activation race
      await supabase.from("cars").update({ price_usd: sale, original_price_usd: pre }).eq("id", promo.car_id);
      activated += 1;
    }

    // End active promos whose window has closed → revert the price.
    const { data: toEnd } = await supabase
      .from("promotions")
      .select("id, car_id, pre_promo_price_usd")
      .eq("status", "active")
      .not("ends_at", "is", null)
      .lte("ends_at", nowIso)
      .limit(100);

    for (const promo of toEnd || []) {
      if (promo.pre_promo_price_usd != null) {
        await supabase.from("cars").update({ price_usd: promo.pre_promo_price_usd, original_price_usd: null }).eq("id", promo.car_id);
      }
      await supabase.from("promotions").update({ status: "ended" }).eq("id", promo.id);
      ended += 1;
    }

    logEvent("cron.promotions_apply", { activated, ended });
    return NextResponse.json({ ok: true, activated, ended });
  } catch (error) {
    reportServerError("GET /api/cron/promotions-apply", error).catch(() => {});
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
