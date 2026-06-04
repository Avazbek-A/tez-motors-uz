/**
 * Chat-first customer outbound (Phase AI).
 *
 * The dealer's audience lives on Telegram/WhatsApp, but every proactive
 * customer message (order status, price drops, saved-search matches, nurture)
 * historically went out over email + web-push only. `sendToCustomer` routes a
 * single structured message to the customer's best channel:
 *
 *   notify_channel = a specific channel  → only that channel (respect the choice)
 *   notify_channel = null / "auto"       → Telegram DM first; if it lands, stop
 *                                          (chat-first). Otherwise fall back to
 *                                          the existing push + email pair.
 *
 * This guarantees a customer never gets the SAME event on three channels at
 * once: Telegram replaces the push+email pair when present, and falls back to
 * it cleanly when the customer has no Telegram identity or the send fails.
 *
 * Fail-open throughout — a delivery problem must never break the request or job
 * that triggered it. Each underlying helper (sendBotMessage, sendPushToMany,
 * sendEmail) already swallows its own errors.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendBotMessage } from "./telegram";
import { sendPushToMany, type PushSubscriptionRecord } from "./push";
import { sendEmail } from "./email";
import { escapeHtml } from "./escape-html";

export type NotifyChannel = "telegram" | "push" | "email";

export interface OutboundCustomer {
  id?: string | null;
  phone?: string | null;
  telegram_id?: number | string | null;
  email?: string | null;
  locale?: string | null;
  /** null / "auto" → smart fan-out; a specific channel → strict. */
  notify_channel?: string | null;
}

export interface OutboundMessage {
  /** Short heading (e.g. the status label). Plain text; escaped for Telegram. */
  title: string;
  /** One-line body. Plain text; escaped for Telegram. */
  body: string;
  /** Deep link — relative ("/ru/track") or absolute. Becomes the button URL. */
  url?: string;
  buttonLabel?: string;
  /** Email fallback. When omitted, email is skipped (we never email a raw body). */
  email?: { subject: string; html: string } | null;
  /** Web-push de-dupe tag. */
  pushTag?: string;
  /** Label for the notification_log (observability / future dedupe). */
  kind?: string;
}

export interface DeliveryResult {
  telegram: boolean;
  push: boolean;
  email: boolean;
  /** True iff at least one channel delivered. */
  delivered: boolean;
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://tezmotors.uz").replace(/\/$/, "");
}

function toAbsolute(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${siteUrl()}${url.startsWith("/") ? "" : "/"}${url}`;
}

async function pushToCustomer(
  supabase: SupabaseClient,
  customerId: string,
  msg: OutboundMessage,
): Promise<boolean> {
  try {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("customer_id", customerId);
    if (!subs || subs.length === 0) return false;
    const { sent } = await sendPushToMany(supabase, subs as PushSubscriptionRecord[], {
      title: msg.title,
      body: msg.body,
      url: msg.url,
      tag: msg.pushTag,
    });
    return sent > 0;
  } catch {
    return false;
  }
}

async function logDelivery(
  supabase: SupabaseClient,
  customerId: string | null | undefined,
  kind: string | undefined,
  channel: NotifyChannel,
): Promise<void> {
  try {
    await supabase.from("notification_log").insert({ customer_id: customerId ?? null, kind: kind ?? null, channel });
  } catch {
    // table may not exist yet (migration unapplied) — fail-open
  }
}

export async function sendToCustomer(
  supabase: SupabaseClient,
  customer: OutboundCustomer,
  msg: OutboundMessage,
): Promise<DeliveryResult> {
  const pref = (customer.notify_channel || "auto").toLowerCase();
  const auto = pref === "auto";
  const wants = (ch: NotifyChannel) => auto || pref === ch;

  const result: DeliveryResult = { telegram: false, push: false, email: false, delivered: false };
  const absUrl = toAbsolute(msg.url);

  // 1) Telegram DM — chat-first. Compose escaped HTML.
  if (customer.telegram_id && wants("telegram")) {
    const text = `<b>${escapeHtml(msg.title)}</b>\n${escapeHtml(msg.body)}`;
    const r = await sendBotMessage(customer.telegram_id, text, { url: absUrl, label: msg.buttonLabel });
    result.telegram = r.ok;
    if (r.ok) logDelivery(supabase, customer.id, msg.kind, "telegram").catch(() => {});
  }

  // In auto mode, a delivered Telegram DM is enough — don't also push + email.
  const telegramSatisfied = result.telegram && auto;

  // 2) Push (fallback in auto, or explicit).
  if (!telegramSatisfied && customer.id && wants("push")) {
    result.push = await pushToCustomer(supabase, customer.id, { ...msg, url: absUrl });
    if (result.push) logDelivery(supabase, customer.id, msg.kind, "push").catch(() => {});
  }

  // 3) Email (fallback in auto, or explicit) — only when a template is supplied.
  if (!telegramSatisfied && customer.email && msg.email && wants("email")) {
    const { ok } = await sendEmail({ to: customer.email, subject: msg.email.subject, html: msg.email.html });
    result.email = ok;
    if (ok) logDelivery(supabase, customer.id, msg.kind, "email").catch(() => {});
  }

  result.delivered = result.telegram || result.push || result.email;
  return result;
}
