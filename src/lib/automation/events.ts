/**
 * Behavioral event spine (Phase AW Leap 2). A lightweight log of what
 * contacts do (car views, etc.) that behavioral journey triggers derive from.
 * Fail-open — telemetry must never break a request.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

export interface RecordEventInput {
  type: string;
  contactPhone?: string | null;
  customerId?: string | null;
  carId?: string | null;
  metadata?: Record<string, unknown>;
  tenantId?: string | null;
}

export async function recordEvent(supabase: SupabaseClient, input: RecordEventInput): Promise<void> {
  if (!input.type) return;
  try {
    await supabase.from("marketing_events").insert({
      type: input.type,
      contact_phone: input.contactPhone ?? null,
      customer_id: input.customerId ?? null,
      car_id: input.carId ?? null,
      metadata: input.metadata ?? {},
      tenant_id: input.tenantId ?? DEFAULT_TENANT_ID,
    }).then(() => {}, () => {});
  } catch {
    /* fail-open */
  }
}
