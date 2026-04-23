/**
 * Send a notification to Telegram when a new inquiry is received.
 * This is fire-and-forget - we don't block the API response on this.
 */
export async function sendTelegramNotification(data: {
  name: string;
  phone: string;
  message?: string;
  type: string;
  source_page?: string;
}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) return;

  const emoji = {
    general: "📩",
    car_inquiry: "🚗",
    callback: "📞",
    calculator: "🧮",
  }[data.type] || "📩";

  const text = [
    `${emoji} *Новая заявка — Tez Motors*`,
    "",
    `👤 *Имя:* ${escapeMarkdown(data.name)}`,
    `📱 *Телефон:* ${escapeMarkdown(data.phone)}`,
    `📋 *Тип:* ${data.type}`,
    data.source_page ? `🔗 *Страница:* ${escapeMarkdown(data.source_page)}` : "",
    data.message ? `\n💬 *Сообщение:*\n${escapeMarkdown(data.message)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Telegram notify non-OK", res.status, body.slice(0, 500));
    }
  } catch (err) {
    console.error("Telegram notify failed", err);
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
