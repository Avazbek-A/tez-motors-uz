/**
 * Create a Payme checkout link for an order's refundable deposit.
 *
 * Gated on reference_code + phone (mirrors /track) so order data never leaks.
 * Pins the expected amount on the order (deposit_amount_tiyin) using the current
 * USD→UZS rate, so the merchant callback (CheckPerformTransaction) validates the
 * amount deterministically even as the rate drifts.
 *
 * Ships dark: when PAYME_MERCHANT_ID is unset, returns 503 — no link, no payment
 * surface. Workers-safe (pure DB + fetch + Web APIs).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import { getUsdUzsRate } from "@/lib/fx-rate";
import { usdToTiyin, tiyinToUzs, DEFAULT_DEPOSIT_USD } from "@/lib/payme";
import { normalizeReferenceCode } from "@/lib/order-code";

const checkRateLimit = createKvRateLimiter({ max: 10, windowMs: 10 * 60 * 1000, prefix: "payme-checkout" });

const PAYME_CHECKOUT_BASE = "https://checkout.paycom.uz";
const CLICK_CHECKOUT_BASE = "https://my.click.uz/services/pay";

const schema = z.object({
  reference_code: z.string().min(3).max(40),
  phone: z.string().min(5).max(20),
  locale: z.enum(["ru", "uz", "en"]).optional(),
  provider: z.enum(["payme", "click"]).default("payme"),
});

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://tezmotors.uz").replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  if (!(await checkRateLimit(getClientIp(request)))) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const data = schema.parse(body);

    // Per-provider config gate — each rail ships dark until its merchant id is set.
    if (data.provider === "click") {
      if (!process.env.CLICK_MERCHANT_ID || !process.env.CLICK_SERVICE_ID) {
        return NextResponse.json({ success: false, error: "Payments not configured" }, { status: 503 });
      }
    } else if (!process.env.PAYME_MERCHANT_ID) {
      return NextResponse.json({ success: false, error: "Payments not configured" }, { status: 503 });
    }

    const supabase = createServiceClient();
    const code = normalizeReferenceCode(data.reference_code);

    const { data: order } = await supabase
      .from("orders")
      .select("id, customer_phone, amount_usd, locale")
      .eq("reference_code", code)
      .maybeSingle();

    // Same not-found response whether the code is wrong or the phone mismatches.
    if (!order || order.customer_phone.trim() !== data.phone.trim()) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    const depositUsd = order.amount_usd && Number(order.amount_usd) > 0 ? Number(order.amount_usd) : DEFAULT_DEPOSIT_USD;
    const rate = await getUsdUzsRate(supabase);

    // Click's callback amount is whole UZS, so align the pinned tiyin to a whole-UZS
    // boundary (×100) — otherwise the rounded callback amount won't match exactly.
    const amountUzs = tiyinToUzs(usdToTiyin(depositUsd, rate));
    const amountTiyin = data.provider === "click" ? amountUzs * 100 : usdToTiyin(depositUsd, rate);

    // Pin the expected amount so the merchant callback can validate it.
    await supabase
      .from("orders")
      .update({ deposit_amount_tiyin: amountTiyin, updated_at: new Date().toISOString() })
      .eq("id", order.id);

    const locale = data.locale ?? (order.locale as string) ?? "ru";
    const callback = `${siteUrl()}/${locale}/track?code=${encodeURIComponent(code)}`;

    let url: string;
    if (data.provider === "click") {
      // Click GET-checkout: transaction_param echoes back as merchant_trans_id.
      const params = new URLSearchParams({
        service_id: process.env.CLICK_SERVICE_ID!,
        merchant_id: process.env.CLICK_MERCHANT_ID!,
        amount: String(amountUzs),
        transaction_param: order.id,
        return_url: callback,
      });
      url = `${CLICK_CHECKOUT_BASE}?${params.toString()}`;
    } else {
      // Payme GET-checkout params, joined by ';' then base64-encoded into the URL.
      const paramStr = `m=${process.env.PAYME_MERCHANT_ID};ac.order_id=${order.id};a=${amountTiyin};c=${callback};l=${locale}`;
      url = `${PAYME_CHECKOUT_BASE}/${btoa(paramStr)}`;
    }

    return NextResponse.json({
      success: true,
      url,
      provider: data.provider,
      amount_tiyin: amountTiyin,
      amount_uzs: amountUzs,
      amount_usd: depositUsd,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
