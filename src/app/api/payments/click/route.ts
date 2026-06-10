/**
 * Click.uz Merchant SHOP-API endpoint — the "Prepare / Complete" callback rail.
 *
 * Click drives a deposit by POSTing application/x-www-form-urlencoded callbacks:
 *   action=0 Prepare   — validate the order + amount, reserve a payment row,
 *                        return merchant_prepare_id
 *   action=1 Complete  — confirm (error=0) or cancel (error<0) the payment
 * Every callback is MD5-signed; we verify it with the shared CLICK_SECRET_KEY.
 *
 * Idempotency: payments has a per-provider UNIQUE (provider, provider_transaction_id)
 * (migration 025), so a re-sent Prepare resolves to the same row and a re-sent
 * Complete never applies the deposit twice. Mirrors the Payme route's
 * advance-only-from-'ordered' guard so we never downgrade an order.
 *
 * Ships dark: when CLICK_SECRET_KEY is unset, verifyClickSign fails closed and
 * every callback returns SIGN_CHECK_FAILED — the endpoint is inert, not crashing.
 *
 * Workers-safe: pure DB + Web APIs, pure-JS MD5 (no node-only deps).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logEvent, alertDealer } from "@/lib/error-report";
import { advanceOrderToDepositPaid } from "@/lib/payment-advance";
import {
  CLICK_ACTION,
  CLICK_ERROR,
  CLICK_MESSAGES,
  verifyClickSign,
  clickResponse,
  clickAmountToTiyin,
  type ClickCallback,
} from "@/lib/click";

type Supabase = ReturnType<typeof createServiceClient>;

// Click payment lifecycle reuses the shared payments.state semantics:
// 1 created (prepared), 2 performed (paid), -1 cancelled.
const CLICK_STATE = { CREATED: 1, PERFORMED: 2, CANCELLED: -1 } as const;

interface ClickPaymentRow {
  id: string;
  order_id: string;
  provider_transaction_id: string;
  amount_tiyin: number;
  state: number;
}

/** Read the callback fields from the urlencoded body into a typed shape. */
function parseCallback(form: URLSearchParams): ClickCallback {
  const get = (k: string) => form.get(k) ?? "";
  return {
    click_trans_id: get("click_trans_id"),
    service_id: get("service_id"),
    merchant_trans_id: get("merchant_trans_id"),
    merchant_prepare_id: get("merchant_prepare_id"),
    amount: get("amount"),
    action: get("action"),
    sign_time: get("sign_time"),
    sign_string: get("sign_string"),
    error: get("error"),
    error_note: get("error_note"),
  };
}

async function findOrder(supabase: Supabase, orderId: string) {
  if (!orderId) return null;
  const { data } = await supabase
    .from("orders")
    .select("id, deposit_amount_tiyin")
    .eq("id", orderId)
    .maybeSingle();
  return data && data.deposit_amount_tiyin != null
    ? { id: data.id as string, deposit_amount_tiyin: Number(data.deposit_amount_tiyin) }
    : null;
}

async function findClickPayment(
  supabase: Supabase,
  clickTransId: string,
): Promise<ClickPaymentRow | null> {
  const { data } = await supabase
    .from("payments")
    .select("id, order_id, provider_transaction_id, amount_tiyin, state")
    .eq("provider", "click")
    .eq("provider_transaction_id", clickTransId)
    .maybeSingle();
  return (data as ClickPaymentRow) ?? null;
}

// ---- Prepare (action=0) ---------------------------------------------------

async function handlePrepare(supabase: Supabase, cb: ClickCallback): Promise<NextResponse> {
  const order = await findOrder(supabase, cb.merchant_trans_id);
  if (!order) {
    return NextResponse.json(
      clickResponse({
        click_trans_id: cb.click_trans_id,
        merchant_trans_id: cb.merchant_trans_id,
        error: CLICK_ERROR.ORDER_NOT_FOUND,
      }),
    );
  }

  if (clickAmountToTiyin(cb.amount) !== order.deposit_amount_tiyin) {
    return NextResponse.json(
      clickResponse({
        click_trans_id: cb.click_trans_id,
        merchant_trans_id: cb.merchant_trans_id,
        error: CLICK_ERROR.INVALID_AMOUNT,
      }),
    );
  }

  // Idempotent re-send: same Click transaction already prepared.
  const existing = await findClickPayment(supabase, cb.click_trans_id);
  if (existing) {
    const error =
      existing.state === CLICK_STATE.PERFORMED ? CLICK_ERROR.ALREADY_PAID : CLICK_ERROR.SUCCESS;
    return NextResponse.json(
      clickResponse({
        click_trans_id: cb.click_trans_id,
        merchant_trans_id: cb.merchant_trans_id,
        merchant_prepare_id: existing.id,
        error,
      }),
    );
  }

  // Block a second concurrent prepare against an order already paid via Click.
  const { data: paid } = await supabase
    .from("payments")
    .select("id")
    .eq("provider", "click")
    .eq("order_id", order.id)
    .eq("state", CLICK_STATE.PERFORMED)
    .limit(1);
  if (paid && paid.length > 0) {
    return NextResponse.json(
      clickResponse({
        click_trans_id: cb.click_trans_id,
        merchant_trans_id: cb.merchant_trans_id,
        error: CLICK_ERROR.ALREADY_PAID,
      }),
    );
  }

  // Block a second prepare while an earlier one for this order is still pending
  // (CREATED, under a DIFFERENT click_trans_id) — mirrors the Payme ORDER_BUSY
  // guard so one order can't accumulate two collectable deposit rows. (Same
  // click_trans_id re-sends are handled by the idempotent `existing` check above.)
  const { data: pending } = await supabase
    .from("payments")
    .select("id")
    .eq("provider", "click")
    .eq("order_id", order.id)
    .eq("state", CLICK_STATE.CREATED)
    .limit(1);
  if (pending && pending.length > 0) {
    return NextResponse.json(
      clickResponse({
        click_trans_id: cb.click_trans_id,
        merchant_trans_id: cb.merchant_trans_id,
        error: CLICK_ERROR.ALREADY_PAID,
      }),
    );
  }

  const { data: inserted, error } = await supabase
    .from("payments")
    .insert({
      order_id: order.id,
      provider: "click",
      provider_transaction_id: cb.click_trans_id,
      amount_tiyin: order.deposit_amount_tiyin,
      state: CLICK_STATE.CREATED,
      create_time: Date.now(),
    })
    .select("id")
    .single();

  if (error || !inserted) {
    // UNIQUE race — another request prepared it first; re-read and echo.
    const raced = await findClickPayment(supabase, cb.click_trans_id);
    if (raced) {
      return NextResponse.json(
        clickResponse({
          click_trans_id: cb.click_trans_id,
          merchant_trans_id: cb.merchant_trans_id,
          merchant_prepare_id: raced.id,
          error: CLICK_ERROR.SUCCESS,
        }),
      );
    }
    return NextResponse.json(
      clickResponse({
        click_trans_id: cb.click_trans_id,
        merchant_trans_id: cb.merchant_trans_id,
        error: CLICK_ERROR.FAILED_TO_UPDATE,
      }),
    );
  }

  logEvent("click.transaction.prepared", { click_tx: cb.click_trans_id, order_id: order.id });
  return NextResponse.json(
    clickResponse({
      click_trans_id: cb.click_trans_id,
      merchant_trans_id: cb.merchant_trans_id,
      merchant_prepare_id: inserted.id,
      error: CLICK_ERROR.SUCCESS,
    }),
  );
}

// ---- Complete (action=1) --------------------------------------------------

async function handleComplete(supabase: Supabase, cb: ClickCallback): Promise<NextResponse> {
  const payment = await findClickPayment(supabase, cb.click_trans_id);
  if (!payment || payment.id !== cb.merchant_prepare_id) {
    return NextResponse.json(
      clickResponse({
        click_trans_id: cb.click_trans_id,
        merchant_trans_id: cb.merchant_trans_id,
        error: CLICK_ERROR.TRANSACTION_NOT_FOUND,
      }),
    );
  }

  // Click reports its own failure via a negative `error` — cancel our side.
  const clickError = Number(cb.error ?? "0");
  if (Number.isFinite(clickError) && clickError < 0) {
    if (payment.state === CLICK_STATE.CREATED) {
      await supabase
        .from("payments")
        .update({ state: CLICK_STATE.CANCELLED, cancel_time: Date.now(), updated_at: new Date().toISOString() })
        .eq("id", payment.id);
    }
    logEvent("click.transaction.cancelled", { click_tx: cb.click_trans_id, order_id: payment.order_id });
    return NextResponse.json(
      clickResponse({
        click_trans_id: cb.click_trans_id,
        merchant_trans_id: cb.merchant_trans_id,
        merchant_confirm_id: payment.id,
        error: CLICK_ERROR.TRANSACTION_CANCELLED,
      }),
    );
  }

  // Idempotent: already performed.
  if (payment.state === CLICK_STATE.PERFORMED) {
    return NextResponse.json(
      clickResponse({
        click_trans_id: cb.click_trans_id,
        merchant_trans_id: cb.merchant_trans_id,
        merchant_confirm_id: payment.id,
        error: CLICK_ERROR.SUCCESS,
      }),
    );
  }
  if (payment.state !== CLICK_STATE.CREATED) {
    return NextResponse.json(
      clickResponse({
        click_trans_id: cb.click_trans_id,
        merchant_trans_id: cb.merchant_trans_id,
        error: CLICK_ERROR.TRANSACTION_CANCELLED,
      }),
    );
  }

  if (clickAmountToTiyin(cb.amount) !== payment.amount_tiyin) {
    return NextResponse.json(
      clickResponse({
        click_trans_id: cb.click_trans_id,
        merchant_trans_id: cb.merchant_trans_id,
        error: CLICK_ERROR.INVALID_AMOUNT,
      }),
    );
  }

  const { error: updErr } = await supabase
    .from("payments")
    .update({ state: CLICK_STATE.PERFORMED, perform_time: Date.now(), updated_at: new Date().toISOString() })
    .eq("id", payment.id)
    .eq("state", CLICK_STATE.CREATED);
  if (updErr) {
    return NextResponse.json(
      clickResponse({
        click_trans_id: cb.click_trans_id,
        merchant_trans_id: cb.merchant_trans_id,
        error: CLICK_ERROR.FAILED_TO_UPDATE,
      }),
    );
  }

  await advanceOrderToDepositPaid(supabase, payment.order_id, "Click");
  logEvent("click.transaction.performed", { click_tx: cb.click_trans_id, order_id: payment.order_id });

  return NextResponse.json(
    clickResponse({
      click_trans_id: cb.click_trans_id,
      merchant_trans_id: cb.merchant_trans_id,
      merchant_confirm_id: payment.id,
      error: CLICK_ERROR.SUCCESS,
    }),
  );
}

// advanceOrderToDepositPaid lives in @/lib/payment-advance — shared with Payme.
// The shared helper does an atomic conditional UPDATE: the order_events insert
// and customer notify fire ONLY on the call that actually transitioned the
// order, so a Click retry / concurrent Complete can't double-notify the buyer.

// ---- Dispatcher -----------------------------------------------------------

export async function POST(request: NextRequest) {
  // Defense in depth: Click callbacks are tiny urlencoded forms (~500 bytes).
  // 32 KB caps an oversized-body DoS attempt without truncating any real
  // callback — and we cap BEFORE the .text() decode so a multi-MB body
  // doesn't waste CPU before the sign-check rejects it anyway.
  const MAX_BODY = 32 * 1024;
  const cl = Number(request.headers.get("content-length") || 0);
  if (cl && cl > MAX_BODY) {
    return NextResponse.json(
      clickResponse({ click_trans_id: "", merchant_trans_id: "", error: CLICK_ERROR.BAD_REQUEST }),
    );
  }

  let form: URLSearchParams;
  try {
    form = new URLSearchParams(await request.text());
  } catch {
    return NextResponse.json(
      clickResponse({ click_trans_id: "", merchant_trans_id: "", error: CLICK_ERROR.BAD_REQUEST }),
    );
  }

  const cb = parseCallback(form);

  // Sign check first — fails closed when CLICK_SECRET_KEY is unset (ships dark).
  if (!verifyClickSign(cb)) {
    return NextResponse.json(
      clickResponse({
        click_trans_id: cb.click_trans_id,
        merchant_trans_id: cb.merchant_trans_id,
        error: CLICK_ERROR.SIGN_CHECK_FAILED,
        error_note: CLICK_MESSAGES[CLICK_ERROR.SIGN_CHECK_FAILED],
      }),
    );
  }

  try {
    const supabase = createServiceClient();
    const action = cb.action.trim();
    if (action === String(CLICK_ACTION.PREPARE)) {
      return await handlePrepare(supabase, cb);
    }
    if (action === String(CLICK_ACTION.COMPLETE)) {
      return await handleComplete(supabase, cb);
    }
    return NextResponse.json(
      clickResponse({
        click_trans_id: cb.click_trans_id,
        merchant_trans_id: cb.merchant_trans_id,
        error: CLICK_ERROR.ACTION_NOT_FOUND,
      }),
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logEvent("click.error", { message: detail }, "error");
    // Money path: surface a broken Click callback to the dealer (throttled).
    alertDealer(
      "Click callback error — Tez Motors",
      [`Action: ${cb.action ?? "(unknown)"}`, `Error: ${detail.slice(0, 800)}`],
      { key: `click.error:${cb.action ?? "?"}` },
    ).catch(() => {});
    return NextResponse.json(
      clickResponse({
        click_trans_id: cb.click_trans_id,
        merchant_trans_id: cb.merchant_trans_id,
        error: CLICK_ERROR.FAILED_TO_UPDATE,
      }),
    );
  }
}
