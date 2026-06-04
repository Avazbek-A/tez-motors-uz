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
import { priceDropAlertEmail } from "./email";
import { sendToCustomer } from "./customer-messaging";

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

    const typedWatches = watches as Array<{
      id: string;
      email: string;
      target_price_usd: number;
      customer_id: string | null;
    }>;

    // Resolve account channels (telegram_id / notify_channel) for watchers who
    // have an account, in one batch — so chat-first routing can reach them.
    const accountIds = Array.from(
      new Set(typedWatches.map((w) => w.customer_id).filter((x): x is string => !!x)),
    );
    const accountById = new Map<string, { telegram_id: number | null; notify_channel: string | null }>();
    if (accountIds.length > 0) {
      const { data: accts } = await supabase
        .from("customers")
        .select("id, telegram_id, notify_channel")
        .in("id", accountIds);
      for (const a of accts || []) {
        accountById.set(a.id as string, {
          telegram_id: (a.telegram_id as number) ?? null,
          notify_channel: (a.notify_channel as string) ?? null,
        });
      }
    }

    const carName = `${car.brand} ${car.model}${car.year ? ` ${car.year}` : ""}`;
    let sent = 0;

    for (const w of typedWatches) {
      // price_watches has no locale column; default to ru (the dealer's primary market).
      const tpl = priceDropAlertEmail("ru", {
        carName,
        newPrice: car.price_usd,
        targetPrice: Number(w.target_price_usd),
        slug: car.slug,
      });
      const acct = w.customer_id ? accountById.get(w.customer_id) : undefined;
      const res = await sendToCustomer(
        supabase,
        {
          id: w.customer_id,
          telegram_id: acct?.telegram_id ?? null,
          email: w.email,
          locale: "ru",
          notify_channel: acct?.notify_channel ?? null,
        },
        {
          title: "Цена снижена",
          body: `${carName} — цена снизилась до вашей цели ($${Math.round(car.price_usd).toLocaleString("en-US")})`,
          url: `/ru/catalog/${car.slug}`,
          buttonLabel: "Открыть авто",
          email: { subject: tpl.subject, html: tpl.html },
          pushTag: `price-drop-${car.slug}`,
          kind: "price_drop",
        },
      );
      // Only stamp notified when at least one channel actually delivered, so an
      // unconfigured/down stack leaves the watch pending for a later run.
      if (!res.delivered) continue;
      await supabase
        .from("price_watches")
        .update({ notified_at: new Date().toISOString(), notified_price_usd: car.price_usd })
        .eq("id", w.id);
      sent += 1;
    }

    return sent;
  } catch (err) {
    console.error("notifyPriceWatchers failed", err);
    return 0;
  }
}
