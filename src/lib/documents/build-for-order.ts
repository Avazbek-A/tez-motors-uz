/**
 * Server helper (Phase AF): fetch an order + car + deposit and build a document.
 * Shared by the HTML route and the PDF route so the data-join lives in one place.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUsdUzsRate } from "@/lib/fx-rate";
import { buildDocument, documentNumber, type DocType, type DocLocale } from "./templates";

export async function buildOrderDocument(
  supabase: SupabaseClient,
  orderId: string,
  type: DocType,
  locale: DocLocale,
): Promise<{ title: string; html: string; reference: string } | null> {
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, reference_code, customer_name, customer_phone, customer_email, amount_usd, status, car_id, cars(brand, model, year, color)")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) return null;

  const usdUzs = await getUsdUzsRate(supabase).catch(() => 12600);
  const { data: pays } = await supabase.from("payments").select("amount_tiyin").eq("order_id", orderId).eq("state", 2);
  const depositUzs = (pays || []).reduce((a, p) => a + (Number(p.amount_tiyin) || 0), 0) / 100;
  const depositUsd = usdUzs > 0 ? Math.round(depositUzs / usdUzs) : 0;

  const carRel = order.cars as { brand: string; model: string; year: number; color: string | null } | { brand: string; model: string; year: number; color: string | null }[] | null;
  const car = Array.isArray(carRel) ? carRel[0] : carRel;

  const { title, html } = buildDocument(type, {
    number: documentNumber(type, order.reference_code),
    date: new Date().toISOString().slice(0, 10),
    locale,
    order: {
      reference_code: order.reference_code,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_email: order.customer_email,
      amount_usd: order.amount_usd,
      status: order.status,
    },
    car: car ? { brand: car.brand, model: car.model, year: car.year, color: car.color } : null,
    depositUsd,
    vatPct: 12,
    usdUzs,
  });
  return { title, html, reference: order.reference_code };
}
