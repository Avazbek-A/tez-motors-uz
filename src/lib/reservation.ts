/**
 * Shared reservation → order creation (Phase AS).
 *
 * The atomic "reserve a car + create the trackable order" flow used by both the
 * web reservation route and the Telegram/WhatsApp chat-commerce path. Extracting
 * it keeps the race-safe `available → reserved` conditional UPDATE (and the
 * inquiry/order/event writes) in ONE place so the two callers can't drift.
 *
 * Returns a typed result; callers do their own notify/confirm and response
 * shaping. Never throws on the expected failure modes (not found, taken).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateReferenceCode } from "@/lib/order-code";
import type { Attribution } from "@/lib/attribution";
import { exitActiveEnrollments } from "@/lib/automation/enroll";

export interface ReserveInput {
  carId: string;
  name: string;
  phone: string;
  email?: string | null;
  locale?: string | null;
  amountUsd?: string | number | null;
  notes?: string | null;
  attribution?: Attribution | null;
  sourcePage?: string;
}

export type ReserveResult =
  | { ok: true; referenceCode: string | null; inquiryId: string; car: { brand: string; model: string; year: number } }
  | { ok: false; reason: "not_found" | "unavailable" | "failed" };

export async function reserveCarAndCreateOrder(
  supabase: SupabaseClient,
  input: ReserveInput,
): Promise<ReserveResult> {
  const { data: car, error: carError } = await supabase
    .from("cars")
    .select("id, brand, model, year, inventory_status")
    .eq("id", input.carId)
    .single();
  if (carError || !car) return { ok: false, reason: "not_found" };
  if (car.inventory_status !== "available") return { ok: false, reason: "unavailable" };

  // Atomic gate: only the request that flips available→reserved proceeds.
  const { error: updateError, data: updatedCar } = await supabase
    .from("cars")
    .update({ inventory_status: "reserved", updated_at: new Date().toISOString() })
    .eq("id", input.carId)
    .eq("inventory_status", "available")
    .select("id")
    .single();
  if (updateError || !updatedCar) return { ok: false, reason: "unavailable" };

  const amount = input.amountUsd ?? null;
  const { data: inquiry, error: inquiryError } = await supabase
    .from("inquiries")
    .insert({
      type: "reservation",
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      car_id: input.carId,
      status: "new",
      source_page: input.sourcePage ?? "reservation",
      message: `Reservation request for ${car.brand} ${car.model} ${car.year}${amount ? `, deposit: $${amount}` : ""}${input.notes ? `, notes: ${input.notes}` : ""}`,
      metadata: {
        amount_usd: amount,
        notes: input.notes ?? null,
        ...(input.attribution ? { attribution: input.attribution } : {}),
      },
    })
    .select("id")
    .single();
  if (inquiryError || !inquiry) return { ok: false, reason: "failed" };

  let referenceCode: string | null = null;
  for (let attempt = 0; attempt < 2 && !referenceCode; attempt++) {
    const code = generateReferenceCode();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        reference_code: code,
        status: "ordered",
        car_id: input.carId,
        inquiry_id: inquiry.id,
        customer_name: input.name,
        customer_phone: input.phone,
        customer_email: input.email || null,
        locale: input.locale ?? "ru",
        amount_usd: amount ? Number(amount) || null : null,
        notes: input.notes ?? null,
        attribution: input.attribution ?? null,
      })
      .select("id")
      .single();
    if (!orderError && order) {
      referenceCode = code;
      await supabase.from("order_events").insert({ order_id: order.id, status: "ordered", note: "Reservation received" });
    }
  }

  // If we reserved the car but could NOT create a trackable order (both code
  // attempts failed), do not report success — that would leave the car stuck
  // `reserved` forever with no order behind it. Roll the reservation back to
  // `available` (guarded so we never clobber a car a concurrent request has
  // since sold/re-reserved) and surface an honest failure. The inquiry row
  // stays as a lead the dealer can still see.
  if (!referenceCode) {
    await supabase
      .from("cars")
      .update({ inventory_status: "available", updated_at: new Date().toISOString() })
      .eq("id", input.carId)
      .eq("inventory_status", "reserved");
    return { ok: false, reason: "failed" };
  }

  // Conversion: the lead reserved → stop any active nurture drips for them.
  exitActiveEnrollments(supabase, input.phone).catch(() => {});

  return { ok: true, referenceCode, inquiryId: inquiry.id as string, car: { brand: car.brand, model: car.model, year: car.year } };
}
