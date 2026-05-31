/**
 * App-layer price-drop notifications.
 *
 * Replaces the old DB trigger (migration 009, dropped in 016): a Postgres
 * trigger could not call the Resend HTTP API, so it only created an internal
 * inquiry the buyer never saw. This runs from the car-update route after a
 * price change and actually emails each watcher whose target was reached, then
 * marks them notified so they aren't emailed twice.
 *
 * Fail-open: any error is logged and swallowed — a notification problem must
 * never fail the admin's car save.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, priceDropAlertEmail } from "./email";
import { sendPushToMany, type PushSubscriptionRecord } from "./push";

export interface WatchableCar {
  id: string;
  slug: string;
  brand: string;
  model: string;
  year: number | null;
  price_usd: number;
}

/**
 * Email everyone watching `car` whose target price is now met, then stamp
 * notified_at so they don't get re-alerted. Only sends when the email actually
 * goes out (ok=true), so an unconfigured Resend leaves watches pending rather
 * than silently consuming them.
 */
export async function notifyPriceWatchers(
  supabase: SupabaseClient,
  car: WatchableCar,
): Promise<number> {
  try {
    const { data: watches, error } = await supabase
      .from("price_watches")
      .select("id, email, target_price_usd, customer_id")
      .eq("car_id", car.id)
      .is("notified_at", null)
      .gte("target_price_usd", car.price_usd);

    if (error || !watches || watches.length === 0) return 0;

    const carName = `${car.brand} ${car.model}${car.year ? ` ${car.year}` : ""}`;
    let sent = 0;
    const notifiedCustomerIds = new Set<string>();

    for (const w of watches as Array<{
      id: string;
      email: string;
      target_price_usd: number;
      customer_id: string | null;
    }>) {
      // price_watches has no locale column; default to ru (the dealer's primary market).
      const tpl = priceDropAlertEmail("ru", {
        carName,
        newPrice: car.price_usd,
        targetPrice: Number(w.target_price_usd),
        slug: car.slug,
      });
      const { ok } = await sendEmail({ to: w.email, subject: tpl.subject, html: tpl.html });
      if (!ok) continue;
      await supabase
        .from("price_watches")
        .update({ notified_at: new Date().toISOString(), notified_price_usd: car.price_usd })
        .eq("id", w.id);
      sent += 1;
      if (w.customer_id) notifiedCustomerIds.add(w.customer_id);
    }

    // Web push to any notified watcher who has an account + a subscription
    // (fail-open; sendPushToMany no-ops when VAPID keys are unset).
    if (notifiedCustomerIds.size > 0) {
      await pushPriceDrop(supabase, Array.from(notifiedCustomerIds), carName, car.slug);
    }

    return sent;
  } catch (err) {
    console.error("notifyPriceWatchers failed", err);
    return 0;
  }
}

async function pushPriceDrop(
  supabase: SupabaseClient,
  customerIds: string[],
  carName: string,
  slug: string,
): Promise<void> {
  try {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("customer_id", customerIds);
    if (!subs || subs.length === 0) return;
    await sendPushToMany(supabase, subs as PushSubscriptionRecord[], {
      title: "Цена снижена",
      body: `${carName} — цена снизилась до вашей цели`,
      url: `/ru/catalog/${slug}`,
      tag: `price-drop-${slug}`,
    });
  } catch {
    // fail-open
  }
}
