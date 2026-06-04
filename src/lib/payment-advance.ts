/**
 * Shared payment-callback side-effect: advance an order to `deposit_paid` and
 * fire the customer-facing notify + add a timeline event — atomically and
 * exactly once across concurrent / replayed provider callbacks.
 *
 * Previous behaviour (Payme + Click had near-identical copies):
 *   1. SELECT order
 *   2. JS check `if (order.status === "ordered")` then UPDATE
 *   3. ALWAYS insert order_events + send notifyOrderStatus
 *
 * Step 3 fired even when step 2's UPDATE was a no-op (order already advanced)
 * — so two concurrent payment callbacks, or a provider retry after a network
 * blip, would log a duplicate "deposit paid" event on the customer-visible
 * timeline AND send a second deposit-paid email/push.
 *
 * The fix: do the UPDATE with `.eq("status","ordered")` AND `.select()` so the
 * row is RETURNED only when the predicate matched. Side effects fire only on
 * that path. The UPDATE itself is the atomic primitive (single SQL statement),
 * so two racing callers can't both see "yes I advanced it".
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyOrderStatus } from "@/lib/order-status";

type CarRel =
  | { brand: string; model: string; year: number }
  | { brand: string; model: string; year: number }[]
  | null;

interface AdvanceResult {
  /** True iff THIS call was the one that actually transitioned the order. */
  advanced: boolean;
}

export async function advanceOrderToDepositPaid(
  supabase: SupabaseClient,
  orderId: string,
  provider: "Payme" | "Click",
): Promise<AdvanceResult> {
  // Conditional UPDATE: matches only an order still in 'ordered' state. The
  // .select(...) returns rows only for the rows actually updated — so an empty
  // `rows` means "someone else won" (or the order is past 'ordered'). This is
  // the single race-safe gate.
  const { data: rows } = await supabase
    .from("orders")
    .update({ status: "deposit_paid", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "ordered")
    .select("id, reference_code, customer_email, customer_phone, locale, cars(brand, model, year)");

  // No row → already advanced (by a duplicate callback, a retry, or the dealer
  // manually). Don't insert a duplicate event, don't re-notify the customer.
  const row = rows && rows.length > 0 ? rows[0] : null;
  if (!row) return { advanced: false };

  // From here we're THE caller that advanced the order — fire side effects.
  await supabase.from("order_events").insert({
    order_id: orderId,
    status: "deposit_paid",
    note: `Депозит оплачен онлайн (${provider})`,
  });

  const carRel = row.cars as CarRel;
  const car = Array.isArray(carRel) ? carRel[0] : carRel;
  const carName = car ? `${car.brand} ${car.model} ${car.year}` : "Ваш автомобиль";

  await notifyOrderStatus(
    supabase,
    {
      referenceCode: row.reference_code,
      locale: row.locale,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      carName,
    },
    "deposit_paid",
  ).catch(() => {});

  return { advanced: true };
}
