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
  metadata?: Record<string, unknown>;
}): Promise<{ configured: boolean; ok: boolean }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) return { configured: false, ok: false };

  const emoji = {
    general: "📩",
    car_inquiry: "🚗",
    callback: "📞",
    calculator: "🧮",
    part_inquiry: "🔧",
    reservation: "📝",
    test_drive: "🛣️",
    trade_in: "🔄",
    service: "🛠️",
  }[data.type] || "📩";

  const partLine =
    data.type === "part_inquiry" && data.metadata
      ? [
          data.metadata.part_name ? `🔧 *Запчасть:* ${escapeMarkdown(String(data.metadata.part_name))}` : "",
          data.metadata.oem_number ? `🔖 *OEM:* ${escapeMarkdown(String(data.metadata.oem_number))}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  const text = [
    `${emoji} *Новая заявка — Tez Motors*`,
    "",
    `👤 *Имя:* ${escapeMarkdown(data.name)}`,
    `📱 *Телефон:* ${escapeMarkdown(data.phone)}`,
    `📋 *Тип:* ${data.type}`,
    partLine,
    data.source_page ? `🔗 *Страница:* ${escapeMarkdown(data.source_page)}` : "",
    data.message ? `\n💬 *Сообщение:*\n${escapeMarkdown(data.message)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // One-tap actions for the dealer: message the customer back on WhatsApp,
  // and jump straight to the inquiry list in the admin panel.
  const adminUrl =
    (process.env.NEXT_PUBLIC_SITE_URL || "https://tezmotors.uz").replace(/\/$/, "") +
    "/admin/inquiries";
  const waDigits = toWaDigits(data.phone);
  const buttons: { text: string; url: string }[] = [];
  if (waDigits) buttons.push({ text: "💬 WhatsApp", url: `https://wa.me/${waDigits}` });
  buttons.push({ text: "📋 Открыть в админке", url: adminUrl });

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: [buttons] },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Telegram notify non-OK", res.status, body.slice(0, 500));
      return { configured: true, ok: false };
    }
    return { configured: true, ok: true };
  } catch (err) {
    console.error("Telegram notify failed", err);
    return { configured: true, ok: false };
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

/**
 * Normalize a user-entered phone into wa.me-ready international digits.
 * Uzbek local numbers (9 digits) get the 998 country code prepended.
 * Returns "" if the input has no usable digits.
 */
function toWaDigits(phone: string): string {
  let digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 9) digits = "998" + digits; // local UZ mobile
  else if (digits.startsWith("8") && digits.length === 12) digits = "99" + digits; // 8XX… typo guard
  return digits;
}
