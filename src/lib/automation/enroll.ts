/**
 * Journey enrollment (Phase AW) — server side. Called at trigger points
 * (new lead, delivered order, …) to enroll a contact into every active journey
 * for that trigger. Fail-open: enrollment must never break the request that
 * triggered it. The DB's partial-unique index dedupes active enrollments, so a
 * double trigger can't double-drip.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { initialEnrollment, type JourneyStep, type JourneyTrigger } from "./journey";

export interface EnrollContact {
  phone: string;
  name?: string | null;
  email?: string | null;
  locale?: string | null;
  customerId?: string | null;
  carId?: string | null;
  context?: Record<string, unknown>;
  tenantId?: string | null;
}

/** Enroll a contact into all active journeys for `trigger`. Returns count enrolled. */
export async function enrollInJourneys(
  supabase: SupabaseClient,
  trigger: JourneyTrigger,
  contact: EnrollContact,
): Promise<number> {
  if (!contact.phone || contact.phone.trim().length < 3) return 0;
  const tenantId = contact.tenantId || DEFAULT_TENANT_ID;
  try {
    const { data: journeys } = await supabase
      .from("automation_journeys")
      .select("id, steps")
      .eq("trigger_event", trigger)
      .eq("status", "active")
      .eq("tenant_id", tenantId)
      .limit(50);
    if (!journeys || journeys.length === 0) return 0;

    const now = Date.now();
    let enrolled = 0;
    for (const j of journeys) {
      const steps = (j.steps as JourneyStep[]) || [];
      if (steps.length === 0) continue;
      const init = initialEnrollment(steps, now);
      // Insert; the partial-unique (journey_id, lower(phone)) where active makes
      // a re-enroll a no-op conflict we swallow.
      const { error } = await supabase.from("journey_enrollments").insert({
        journey_id: j.id,
        contact_phone: contact.phone,
        contact_name: contact.name ?? null,
        contact_email: contact.email ?? null,
        contact_locale: contact.locale ?? "ru",
        customer_id: contact.customerId ?? null,
        car_id: contact.carId ?? null,
        current_step: init.current_step,
        status: init.status,
        next_run_at: init.next_run_at,
        context: contact.context ?? {},
        tenant_id: tenantId,
      });
      if (!error) enrolled += 1;
    }
    return enrolled;
  } catch {
    return 0; // fail-open
  }
}
