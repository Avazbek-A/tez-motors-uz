import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logEvent } from "@/lib/error-report";
import { ORDER_STATUSES, notifyOrderStatus } from "@/lib/order-status";
import { logAdminAction } from "@/lib/audit";

const updateSchema = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    note: z.string().max(1000).optional().nullable(),
  })
  .refine((v) => v.status !== undefined || (v.note != null && v.note !== ""), {
    message: "Provide a status or a note",
  });

// GET - one order with its event history (admin detail view).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;
  const { id } = await params;

  try {
    const supabase = createServiceClient();
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, reference_code, status, customer_name, customer_phone, customer_email, locale, amount_usd, notes, created_at, updated_at, car_id, cars(brand, model, year, slug)",
      )
      .eq("id", id)
      .single();

    if (error || !order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    const { data: events } = await supabase
      .from("order_events")
      .select("id, status, note, created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: true });

    // Signed documents (Phase AR) — best-effort; table may predate this order.
    const { data: signatures } = await supabase
      .from("document_signatures")
      .select("document_type, signer_name, signed_at")
      .eq("order_id", id)
      .order("signed_at", { ascending: false });

    return NextResponse.json({ success: true, order, events: events || [], signatures: signatures || [] });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to load order" }, { status: 500 });
  }
}

// PATCH - advance status and/or append a note, then notify the customer.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;
  const { id } = await params;

  try {
    const body = await request.json();
    const result = updateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, errors: result.error.issues }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select(
        "id, reference_code, status, customer_email, customer_phone, locale, cars(brand, model, year)",
      )
      .eq("id", id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    const newStatus = result.data.status ?? order.status;
    const note = result.data.note ?? null;

    // Update the order row only when the status actually changes.
    if (result.data.status && result.data.status !== order.status) {
      const { error: updateError } = await supabase
        .from("orders")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (updateError) {
        return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
      }
      logEvent("order.status_changed", {
        order_id: id,
        reference_code: order.reference_code,
        from: order.status,
        to: newStatus,
      });
    }

    // Append an audit event (status change or standalone note).
    const { error: eventError } = await supabase.from("order_events").insert({
      order_id: id,
      status: newStatus,
      note,
    });
    if (eventError) {
      return NextResponse.json({ success: false, error: eventError.message }, { status: 500 });
    }

    // Notify the customer of the new status (email + web push; both fail-open).
    if (result.data.status && result.data.status !== order.status) {
      const carRel = order.cars as
        | { brand: string; model: string; year: number }
        | { brand: string; model: string; year: number }[]
        | null;
      const car = Array.isArray(carRel) ? carRel[0] : carRel;
      const carName = car ? `${car.brand} ${car.model} ${car.year}` : "Ваш автомобиль";

      notifyOrderStatus(
        supabase,
        {
          referenceCode: order.reference_code,
          locale: order.locale,
          customerEmail: order.customer_email,
          customerPhone: order.customer_phone,
          carName,
        },
        newStatus,
        note,
      ).catch(() => {});
    }

    logAdminAction(request, {
      action: result.data.status && result.data.status !== order.status ? "status_change" : "update",
      entity: "order",
      entity_id: id,
      diff: {
        reference_code: order.reference_code,
        ...(result.data.status && result.data.status !== order.status
          ? { from: order.status, to: newStatus }
          : {}),
        ...(note ? { note } : {}),
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Failed to update order" }, { status: 500 });
  }
}
