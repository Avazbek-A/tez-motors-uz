/**
 * Payme (Paycom) Merchant API endpoint — JSON-RPC 2.0 over a single POST.
 *
 * Payme calls this to drive a deposit: CheckPerformTransaction →
 * CreateTransaction → PerformTransaction (and Cancel/Check/GetStatement). Every
 * call is authenticated with the merchant key (Basic auth). The UNIQUE
 * payme_transaction_id column is the idempotency guard: a re-sent
 * CreateTransaction resolves to the same row, a re-sent PerformTransaction never
 * applies the deposit twice.
 *
 * Ships dark: when PAYME_MERCHANT_KEY is unset, auth fails closed and every call
 * returns -32504 — the endpoint is inert, not crashing.
 *
 * Workers-safe: pure DB + Web APIs, no node-only deps.
 */
import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logEvent, alertDealer } from "@/lib/error-report";
import { advanceOrderToDepositPaid } from "@/lib/payment-advance";
import {
  PAYME_STATE,
  PAYME_ERROR,
  PAYME_MESSAGES,
  PAYME_ACCOUNT_FIELD,
  checkPaymeAuth,
  rpcResult,
  rpcError,
} from "@/lib/payme";

type Supabase = ReturnType<typeof createServiceClient>;

interface PaymentRow {
  id: string;
  order_id: string;
  payme_transaction_id: string;
  amount_tiyin: number;
  state: number;
  reason: number | null;
  create_time: number;
  perform_time: number;
  cancel_time: number;
}

function getOrderId(account: unknown): string | null {
  if (!account || typeof account !== "object") return null;
  const v = (account as Record<string, unknown>)[PAYME_ACCOUNT_FIELD];
  return typeof v === "string" && v.length > 0 ? v : null;
}

// Validate that `amount` (tiyin) matches the order's pinned deposit. Returns the
// order row on success, or an error code to surface.
async function resolveOrder(
  supabase: Supabase,
  account: unknown,
  amount: unknown,
): Promise<
  | { ok: true; order: { id: string; deposit_amount_tiyin: number } }
  | { ok: false; code: number }
> {
  const orderId = getOrderId(account);
  if (!orderId) return { ok: false, code: PAYME_ERROR.ORDER_NOT_FOUND };

  const { data: order } = await supabase
    .from("orders")
    .select("id, deposit_amount_tiyin")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.deposit_amount_tiyin == null) {
    return { ok: false, code: PAYME_ERROR.ORDER_NOT_FOUND };
  }
  if (typeof amount !== "number" || amount !== order.deposit_amount_tiyin) {
    return { ok: false, code: PAYME_ERROR.INVALID_AMOUNT };
  }
  return { ok: true, order: { id: order.id, deposit_amount_tiyin: order.deposit_amount_tiyin } };
}

function accountErrorMessage(code: number) {
  return code === PAYME_ERROR.INVALID_AMOUNT
    ? PAYME_MESSAGES.invalidAmount
    : PAYME_MESSAGES.orderNotFound;
}

async function findPayment(
  supabase: Supabase,
  paymeTxId: string,
): Promise<PaymentRow | null> {
  const { data } = await supabase
    .from("payments")
    .select(
      "id, order_id, payme_transaction_id, amount_tiyin, state, reason, create_time, perform_time, cancel_time",
    )
    .eq("payme_transaction_id", paymeTxId)
    .maybeSingle();
  return (data as PaymentRow) ?? null;
}

// ---- Methods --------------------------------------------------------------

async function checkPerformTransaction(supabase: Supabase, params: Record<string, unknown>, id: unknown) {
  const resolved = await resolveOrder(supabase, params.account, params.amount);
  if (!resolved.ok) {
    return rpcError(id, {
      code: resolved.code,
      message: accountErrorMessage(resolved.code),
      data: PAYME_ACCOUNT_FIELD,
    });
  }
  return rpcResult(id, { allow: true });
}

async function createTransaction(supabase: Supabase, params: Record<string, unknown>, id: unknown) {
  const paymeTxId = String(params.id ?? "");
  const time = typeof params.time === "number" ? params.time : Date.now();

  // Idempotent re-send: same Payme tx id already created.
  const existing = await findPayment(supabase, paymeTxId);
  if (existing) {
    if (existing.state === PAYME_STATE.CREATED) {
      return rpcResult(id, {
        create_time: existing.create_time,
        transaction: existing.id,
        state: PAYME_STATE.CREATED,
      });
    }
    return rpcError(id, { code: PAYME_ERROR.CANNOT_PERFORM, message: PAYME_MESSAGES.cannotPerform });
  }

  const resolved = await resolveOrder(supabase, params.account, params.amount);
  if (!resolved.ok) {
    return rpcError(id, {
      code: resolved.code,
      message: accountErrorMessage(resolved.code),
      data: PAYME_ACCOUNT_FIELD,
    });
  }

  // Reject a second concurrent transaction for the same order.
  const { data: active } = await supabase
    .from("payments")
    .select("id")
    .eq("order_id", resolved.order.id)
    .eq("state", PAYME_STATE.CREATED)
    .limit(1);
  if (active && active.length > 0) {
    return rpcError(id, {
      code: PAYME_ERROR.ORDER_BUSY,
      message: PAYME_MESSAGES.orderBusy,
      data: PAYME_ACCOUNT_FIELD,
    });
  }

  const { data: inserted, error } = await supabase
    .from("payments")
    .insert({
      order_id: resolved.order.id,
      payme_transaction_id: paymeTxId,
      amount_tiyin: resolved.order.deposit_amount_tiyin,
      state: PAYME_STATE.CREATED,
      create_time: time,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    // A UNIQUE race means another request created it first — re-read and return.
    const raced = await findPayment(supabase, paymeTxId);
    if (raced && raced.state === PAYME_STATE.CREATED) {
      return rpcResult(id, {
        create_time: raced.create_time,
        transaction: raced.id,
        state: PAYME_STATE.CREATED,
      });
    }
    return rpcError(id, { code: PAYME_ERROR.CANNOT_PERFORM, message: PAYME_MESSAGES.cannotPerform });
  }

  logEvent("payme.transaction.created", { payme_tx: paymeTxId, order_id: resolved.order.id });
  return rpcResult(id, {
    create_time: time,
    transaction: inserted.id,
    state: PAYME_STATE.CREATED,
  });
}

async function performTransaction(supabase: Supabase, params: Record<string, unknown>, id: unknown) {
  const paymeTxId = String(params.id ?? "");
  const payment = await findPayment(supabase, paymeTxId);
  if (!payment) {
    return rpcError(id, { code: PAYME_ERROR.TRANSACTION_NOT_FOUND, message: PAYME_MESSAGES.transactionNotFound });
  }

  // Idempotent: already performed.
  if (payment.state === PAYME_STATE.PERFORMED) {
    return rpcResult(id, {
      transaction: payment.id,
      perform_time: payment.perform_time,
      state: PAYME_STATE.PERFORMED,
    });
  }
  if (payment.state !== PAYME_STATE.CREATED) {
    return rpcError(id, { code: PAYME_ERROR.CANNOT_PERFORM, message: PAYME_MESSAGES.cannotPerform });
  }

  const performTime = Date.now();
  const { error } = await supabase
    .from("payments")
    .update({ state: PAYME_STATE.PERFORMED, perform_time: performTime, updated_at: new Date().toISOString() })
    .eq("id", payment.id)
    .eq("state", PAYME_STATE.CREATED);
  if (error) {
    return rpcError(id, { code: PAYME_ERROR.CANNOT_PERFORM, message: PAYME_MESSAGES.cannotPerform });
  }

  await advanceOrderToDepositPaid(supabase, payment.order_id, "Payme");
  logEvent("payme.transaction.performed", { payme_tx: paymeTxId, order_id: payment.order_id });

  return rpcResult(id, {
    transaction: payment.id,
    perform_time: performTime,
    state: PAYME_STATE.PERFORMED,
  });
}

async function cancelTransaction(supabase: Supabase, params: Record<string, unknown>, id: unknown) {
  const paymeTxId = String(params.id ?? "");
  const reason = typeof params.reason === "number" ? params.reason : null;
  const payment = await findPayment(supabase, paymeTxId);
  if (!payment) {
    return rpcError(id, { code: PAYME_ERROR.TRANSACTION_NOT_FOUND, message: PAYME_MESSAGES.transactionNotFound });
  }

  // Idempotent: already cancelled.
  if (payment.state === PAYME_STATE.CANCELLED || payment.state === PAYME_STATE.CANCELLED_AFTER_PERFORM) {
    return rpcResult(id, {
      transaction: payment.id,
      cancel_time: payment.cancel_time,
      state: payment.state,
    });
  }

  const cancelTime = Date.now();
  const newState =
    payment.state === PAYME_STATE.PERFORMED
      ? PAYME_STATE.CANCELLED_AFTER_PERFORM
      : PAYME_STATE.CANCELLED;

  await supabase
    .from("payments")
    .update({ state: newState, cancel_time: cancelTime, reason, updated_at: new Date().toISOString() })
    .eq("id", payment.id);

  // Record the cancellation on the order timeline so the dealer sees it.
  await supabase.from("order_events").insert({
    order_id: payment.order_id,
    status: "deposit_paid",
    note:
      newState === PAYME_STATE.CANCELLED_AFTER_PERFORM
        ? "Депозит отменён/возвращён через Payme"
        : "Платёж депозита отменён (Payme)",
  });
  logEvent("payme.transaction.cancelled", { payme_tx: paymeTxId, order_id: payment.order_id, state: newState });

  return rpcResult(id, { transaction: payment.id, cancel_time: cancelTime, state: newState });
}

async function checkTransaction(supabase: Supabase, params: Record<string, unknown>, id: unknown) {
  const paymeTxId = String(params.id ?? "");
  const payment = await findPayment(supabase, paymeTxId);
  if (!payment) {
    return rpcError(id, { code: PAYME_ERROR.TRANSACTION_NOT_FOUND, message: PAYME_MESSAGES.transactionNotFound });
  }
  return rpcResult(id, {
    create_time: payment.create_time,
    perform_time: payment.perform_time,
    cancel_time: payment.cancel_time,
    transaction: payment.id,
    state: payment.state,
    reason: payment.reason,
  });
}

async function getStatement(supabase: Supabase, params: Record<string, unknown>, id: unknown) {
  const from = typeof params.from === "number" ? params.from : 0;
  const to = typeof params.to === "number" ? params.to : Date.now();
  const { data: rows } = await supabase
    .from("payments")
    .select(
      "id, order_id, payme_transaction_id, amount_tiyin, state, reason, create_time, perform_time, cancel_time",
    )
    .gte("create_time", from)
    .lte("create_time", to)
    .order("create_time", { ascending: true });

  const transactions = (rows || []).map((r: PaymentRow) => ({
    id: r.payme_transaction_id,
    time: r.create_time,
    amount: r.amount_tiyin,
    account: { [PAYME_ACCOUNT_FIELD]: r.order_id },
    create_time: r.create_time,
    perform_time: r.perform_time,
    cancel_time: r.cancel_time,
    transaction: r.id,
    state: r.state,
    reason: r.reason,
  }));
  return rpcResult(id, { transactions });
}

// Order-advance side effects live in @/lib/payment-advance (shared with Click).
// The helper does an atomic conditional UPDATE — `order_events` insert + notify
// fire ONLY on the call that actually transitioned the order, so a Payme retry
// or two concurrent Performs can't double-notify the customer.

// ---- Dispatcher -----------------------------------------------------------

export async function POST(request: NextRequest) {
  // Auth first: Basic base64(login:merchant_key). Fails closed when unset.
  if (!checkPaymeAuth(request.headers.get("authorization"))) {
    return rpcError(null, { code: PAYME_ERROR.INSUFFICIENT_PRIVILEGE, message: PAYME_MESSAGES.unauthorized });
  }

  // Defense in depth: cap the body before parsing. Payme JSON-RPC frames are
  // ~1 KB; 64 KB is generous headroom while blunting an oversized-body DoS
  // (an attacker who knows the URL but not the auth could otherwise burn
  // Worker CPU on JSON.parse before the next request even arrives).
  const MAX_BODY = 64 * 1024;
  const cl = Number(request.headers.get("content-length") || 0);
  if (cl && cl > MAX_BODY) {
    return rpcError(null, { code: PAYME_ERROR.PARSE_ERROR, message: "Payload too large" });
  }

  let body: { method?: unknown; params?: unknown; id?: unknown };
  try {
    body = await request.json();
  } catch {
    return rpcError(null, { code: PAYME_ERROR.PARSE_ERROR, message: "Parse error" });
  }

  const id = body.id ?? null;
  const method = typeof body.method === "string" ? body.method : "";
  const params = (body.params && typeof body.params === "object" ? body.params : {}) as Record<string, unknown>;

  try {
    const supabase = createServiceClient();
    switch (method) {
      case "CheckPerformTransaction":
        return await checkPerformTransaction(supabase, params, id);
      case "CreateTransaction":
        return await createTransaction(supabase, params, id);
      case "PerformTransaction":
        return await performTransaction(supabase, params, id);
      case "CancelTransaction":
        return await cancelTransaction(supabase, params, id);
      case "CheckTransaction":
        return await checkTransaction(supabase, params, id);
      case "GetStatement":
        return await getStatement(supabase, params, id);
      default:
        return rpcError(id, { code: PAYME_ERROR.METHOD_NOT_FOUND, message: PAYME_MESSAGES.methodNotFound });
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logEvent("payme.error", { method, message: detail }, "error");
    // Money path: a failing callback can silently stall a deposit. Alert the
    // dealer (throttled per-method) so a broken Payme integration is visible.
    alertDealer(
      "Payme callback error — Tez Motors",
      [`Method: ${method || "(unknown)"}`, `Error: ${detail.slice(0, 800)}`],
      { key: `payme.error:${method}` },
    ).catch(() => {});
    return rpcError(id, { code: PAYME_ERROR.CANNOT_PERFORM, message: PAYME_MESSAGES.cannotPerform });
  }
}
