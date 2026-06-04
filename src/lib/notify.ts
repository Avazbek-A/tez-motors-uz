/**
 * Unified new-inquiry notification.
 *
 * The dealer's only alert channel used to be Telegram, fire-and-forget — if
 * Telegram was misconfigured or down, the lead was saved but nobody was told.
 * notifyNewInquiry now fans out to Telegram AND a dealer email in parallel via
 * Promise.allSettled, so one channel failing never suppresses the other. Both
 * are fail-open (each helper swallows its own errors), so notification can
 * never break the API response.
 *
 * confirmToCustomer sends a localized "we got your request" email, and no-ops
 * when the lead left no email (most forms capture phone only).
 */
import { sendTelegramNotification } from "./telegram";
import {
  sendEmail,
  inquiryReceivedEmail,
  type EmailLocale,
} from "./email";
import { logEvent, alertDealer } from "./error-report";
import { escapeHtml as esc } from "@/lib/escape-html";

export interface InquiryNotifyData {
  name: string;
  phone: string;
  email?: string | null;
  message?: string;
  type: string;
  source_page?: string;
  metadata?: Record<string, unknown>;
  locale?: string | null;
}

function normalizeLocale(l?: string | null): EmailLocale {
  return l === "uz" || l === "en" ? l : "ru";
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://tezmotors.uz").replace(/\/$/, "");
}


/** Plain dealer-facing alert email (Russian, matching the Telegram template). */
async function sendDealerEmail(data: InquiryNotifyData): Promise<{ configured: boolean; ok: boolean }> {
  const to = process.env.DEALER_EMAIL;
  if (!to) return { configured: false, ok: false };

  const rows: string[] = [
    `<b>Имя:</b> ${esc(data.name)}`,
    `<b>Телефон:</b> ${esc(data.phone)}`,
    `<b>Тип:</b> ${esc(data.type)}`,
  ];
  if (data.email) rows.push(`<b>Email:</b> ${esc(data.email)}`);
  if (data.source_page) rows.push(`<b>Страница:</b> ${esc(data.source_page)}`);
  if (data.message) rows.push(`<b>Сообщение:</b> ${esc(data.message)}`);

  const adminUrl = `${siteUrl()}/admin/inquiries`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#18181b">
    <p style="font-size:16px;font-weight:bold;margin:0 0 12px">Новая заявка — Tez Motors</p>
    <p style="margin:0 0 16px">${rows.join("<br>")}</p>
    <a href="${adminUrl}" style="display:inline-block;padding:10px 18px;background:#0a0a0f;color:#fff;border-radius:8px;text-decoration:none">Открыть в админке</a>
  </div>`;

  const { ok } = await sendEmail({
    to,
    subject: `Новая заявка (${data.type}) — ${data.name}`,
    html,
    replyTo: data.email || undefined,
  });
  return { configured: true, ok };
}

/**
 * Alert the dealer about a new inquiry over every available channel.
 * Never throws; both channels are independent.
 */
export async function notifyNewInquiry(data: InquiryNotifyData): Promise<void> {
  const [tgResult, emailResult] = await Promise.allSettled([
    sendTelegramNotification({
      name: data.name,
      phone: data.phone,
      message: data.message,
      type: data.type,
      source_page: data.source_page,
      metadata: data.metadata,
    }),
    sendDealerEmail(data),
  ]);

  const tg =
    tgResult.status === "fulfilled" ? tgResult.value : { configured: true, ok: false };
  const email =
    emailResult.status === "fulfilled" ? emailResult.value : { configured: true, ok: false };

  const configured = tg.configured || email.configured;
  const delivered = tg.ok || email.ok;

  // The lead is already persisted; the danger is that it was saved but no one
  // was told. If at least one channel is configured yet every configured
  // channel failed, surface it loudly — a structured log line (always) plus a
  // throttled dealer alert (best-effort; may itself ride the same down channel).
  if (configured && !delivered) {
    logEvent(
      "notify.fanout_failed",
      { type: data.type, telegram_configured: tg.configured, email_configured: email.configured },
      "warn",
    );
    alertDealer(
      "Lead notification failed — Tez Motors",
      [
        "A new lead was saved but every configured alert channel failed.",
        `Type: ${data.type}`,
        `Name: ${data.name}`,
        `Phone: ${data.phone}`,
        "Check it in the admin panel.",
      ],
      { key: "notify.fanout_failed" },
    ).catch(() => {});
  }
}

/**
 * Send the customer a confirmation. No-ops when no email is present.
 *
 * Auto-responder: when AI_AUTORESPOND is set, the customer gets a personalized,
 * grounded AI-drafted reply (fail-open to a template, never invents prices) —
 * end-to-end auto-reply with no dealer action. Otherwise the standard localized
 * "we received your request" template.
 */
export async function confirmToCustomer(data: {
  email?: string | null;
  name?: string;
  locale?: string | null;
  message?: string | null;
  type?: string | null;
  carName?: string | null;
}): Promise<void> {
  if (!data.email) return;
  const locale = normalizeLocale(data.locale);

  if (process.env.AI_AUTORESPOND) {
    const { draftLeadReply } = await import("./sales-ai");
    const { text } = await draftLeadReply({
      locale,
      name: data.name,
      message: data.message ?? null,
      type: data.type ?? null,
      carName: data.carName ?? null,
    });
    const subject =
      locale === "uz" ? "Tez Motors — javob" : locale === "en" ? "Tez Motors — reply" : "Tez Motors — ответ";
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#18181b">${esc(text).replace(/\n/g, "<br>")}</div>`;
    await sendEmail({ to: data.email, subject, html });
    return;
  }

  const tpl = inquiryReceivedEmail(locale, { name: data.name });
  await sendEmail({ to: data.email, subject: tpl.subject, html: tpl.html });
}
