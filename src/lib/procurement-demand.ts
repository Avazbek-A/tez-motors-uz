/**
 * Pre-order demand aggregation (AH-amendment).
 *
 * The Buying Brain keys demand off `cars` (car_id → brand|model). But pre-orders
 * reference `model_catalog`, not `cars`, so the most committed demand signal that
 * exists — a buyer who put a deposit down on an exact made-to-order config — was
 * invisible to procurement. This groups open pre-orders by model and counts how
 * many are merely placed vs. actually deposited, keyed on the SAME
 * `brand|model` key the buying route uses, so the two demand sources fuse.
 *
 * Service-role caller (orders / model_catalog are RLS-locked). Fail-soft: any
 * error returns an empty map so the buying route still renders.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ORDER_STATUSES } from "@/lib/order-status";

/** Same key the buying route uses, so pre-order demand fuses with car demand. */
export function modelKey(brand: string, model: string): string {
  return `${brand}|${model}`.toLowerCase();
}

// An order is "deposited" once it has reached deposit_paid or beyond. A
// pre-order is created at "ordered" (no money yet); the Payme/Click perform
// step advances it to deposit_paid.
const DEPOSIT_INDEX = ORDER_STATUSES.indexOf("deposit_paid");

export function isDepositedStatus(status: string): boolean {
  const i = (ORDER_STATUSES as readonly string[]).indexOf(status);
  return i >= 0 && i >= DEPOSIT_INDEX;
}

// Statuses worth counting as live demand to import against (not delivered, not
// cancelled). We import to fulfill these.
const OPEN_PREORDER_STATUSES = ["ordered", "deposit_paid", "sourcing"] as const;

export interface PreorderDemand {
  brand: string;
  model: string;
  total: number;
  deposited: number;
}

export async function aggregatePreorderDemand(
  supabase: SupabaseClient,
): Promise<Map<string, PreorderDemand>> {
  const out = new Map<string, PreorderDemand>();
  try {
    const { data: orders } = await supabase
      .from("orders")
      .select("model_id, status")
      .eq("is_preorder", true)
      .in("status", OPEN_PREORDER_STATUSES as unknown as string[])
      .not("model_id", "is", null)
      .limit(5000);
    if (!orders || orders.length === 0) return out;

    const modelIds = Array.from(new Set(orders.map((o) => o.model_id as string)));
    const { data: models } = await supabase
      .from("model_catalog")
      .select("id, brand, model")
      .in("id", modelIds);
    const metaById = new Map<string, { brand: string; model: string }>();
    for (const m of models || []) {
      metaById.set(m.id as string, { brand: m.brand as string, model: m.model as string });
    }

    for (const o of orders) {
      const meta = metaById.get(o.model_id as string);
      if (!meta) continue;
      const k = modelKey(meta.brand, meta.model);
      const row = out.get(k) || { brand: meta.brand, model: meta.model, total: 0, deposited: 0 };
      row.total += 1;
      if (isDepositedStatus(o.status as string)) row.deposited += 1;
      out.set(k, row);
    }
    return out;
  } catch {
    return out;
  }
}
