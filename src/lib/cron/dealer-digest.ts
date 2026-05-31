/**
 * Positive dealer-facing digest (not an error alert) over Telegram + email.
 * Used by the scheduled jobs in /api/cron/* to nudge the dealer about
 * follow-ups due, the daily lead summary, etc. Both channels fail-open.
 */
import { sendEmail } from "@/lib/email";

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendDealerDigest(subject: string, lines: string[]): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ERROR_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
  if (botToken && chatId && lines.length > 0) {
    tasks.push(
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📊 ${subject}\n\n${lines.join("\n")}`,
          disable_web_page_preview: true,
        }),
      }).catch(() => {}),
    );
  }

  const to = process.env.DEALER_EMAIL;
  if (to && lines.length > 0) {
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#18181b">
      <p style="font-size:16px;font-weight:bold;margin:0 0 12px">${esc(subject)}</p>
      <p style="margin:0">${lines.map(esc).join("<br>")}</p>
    </div>`;
    tasks.push(sendEmail({ to, subject, html }).catch(() => {}));
  }

  await Promise.allSettled(tasks);
}
