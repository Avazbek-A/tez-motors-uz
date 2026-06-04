/**
 * Shared import-order status vocabulary + customer notification.
 *
 * Both the admin status-advance route (api/admin/orders/[id]) and the Payme
 * deposit-perform path (api/payments/payme) move an order forward and tell the
 * customer. This module is the single source of truth for the localized status
 * labels and the email + web-push fan-out, so the two callers can't drift.
 *
 * Fail-open: notification failures are swallowed; advancing an order must never
 * break the request that triggered it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { orderStatusChangedEmail, type EmailLocale } from "@/lib/email";
import { sendToCustomer } from "@/lib/customer-messaging";

export const ORDER_STATUSES = [
  "ordered",
  "deposit_paid",
  "sourcing",
  "in_transit",
  "at_customs",
  "ready_for_pickup",
  "delivered",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Customer-facing status labels per locale (matches the /track timeline).
export const ORDER_STATUS_LABELS: Record<EmailLocale, Record<string, string>> = {
  ru: {
    ordered: "Заказ оформлен",
    deposit_paid: "Депозит внесён",
    sourcing: "Поиск автомобиля",
    in_transit: "В пути",
    at_customs: "На таможне",
    ready_for_pickup: "Готов к выдаче",
    delivered: "Доставлен",
  },
  uz: {
    ordered: "Buyurtma rasmiylashtirildi",
    deposit_paid: "Depozit to'landi",
    sourcing: "Avtomobil qidirilmoqda",
    in_transit: "Yo'lda",
    at_customs: "Bojxonada",
    ready_for_pickup: "Olishga tayyor",
    delivered: "Yetkazildi",
  },
  en: {
    ordered: "Order placed",
    deposit_paid: "Deposit paid",
    sourcing: "Sourcing",
    in_transit: "In transit",
    at_customs: "At customs",
    ready_for_pickup: "Ready for pickup",
    delivered: "Delivered",
  },
};

/** Coerce an arbitrary stored locale to a supported EmailLocale (defaults to ru). */
export function toEmailLocale(locale: string | null | undefined): EmailLocale {
  return locale === "uz" || locale === "en" ? locale : "ru";
}

export interface OrderNotifyInput {
  referenceCode: string;
  locale: string | null | undefined;
  customerEmail: string | null;
  customerPhone: string;
  carName: string;
}

/**
 * Notify a customer that their order reached `newStatus`: localized email (only
 * when an email is on file) plus web push to any account the phone matches.
 * Both channels fail-open.
 */
export async function notifyOrderStatus(
  supabase: SupabaseClient,
  order: OrderNotifyInput,
  newStatus: string,
  note?: string | null,
): Promise<void> {
  const locale = toEmailLocale(order.locale);
  const statusLabel = ORDER_STATUS_LABELS[locale][newStatus] ?? newStatus;

  const tpl = orderStatusChangedEmail(locale, {
    carName: order.carName,
    statusLabel,
    referenceCode: order.referenceCode,
    note: note ?? undefined,
  });

  // Resolve the customer account (if any) so chat-first routing can reach their
  // Telegram DM / honor their notify_channel. Falls back to the order's own
  // email when there's no account. sendToCustomer handles the channel logic
  // and is fully fail-open.
  type AccountChannels = { id: string; telegram_id: number | null; notify_channel: string | null; email: string | null };
  let account: AccountChannels | null = null;
  try {
    const { data } = await supabase
      .from("customers")
      .select("id, telegram_id, notify_channel, email")
      .eq("phone", order.customerPhone)
      .maybeSingle();
    account = (data as AccountChannels | null) ?? null;
  } catch {
    // no account / table unavailable — proceed with order email only
  }

  await sendToCustomer(
    supabase,
    {
      id: account?.id ?? null,
      phone: order.customerPhone,
      telegram_id: account?.telegram_id ?? null,
      email: order.customerEmail ?? account?.email ?? null,
      locale,
      notify_channel: account?.notify_channel ?? null,
    },
    {
      title: statusLabel,
      body: `${order.carName}: статус заказа обновлён${note ? ` — ${note}` : ""}`,
      url: `/${locale}/track`,
      buttonLabel: "Отследить заказ",
      email: { subject: tpl.subject, html: tpl.html },
      pushTag: "order-status",
      kind: "order_status",
    },
  ).catch(() => {});
}
