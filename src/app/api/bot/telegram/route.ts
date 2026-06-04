/**
 * Inbound Telegram bot webhook.
 *
 * Meets customers where they already are. Free text is answered by the SAME
 * grounded recommender the web "Find my car" widget uses (src/lib/assistant-core
 * → recommendCars), so the bot never invents cars or prices — every suggestion
 * is a real, in-stock row with a deep link to the site. A shared contact (or a
 * typed phone number) creates a qualified lead and notifies the dealer.
 *
 * Reuses the existing inquiry type `car_inquiry` (source_page="telegram-bot",
 * metadata.channel="telegram") to avoid a CHECK-constraint migration.
 *
 * Security: verifies the X-Telegram-Bot-Api-Secret-Token header against
 * TELEGRAM_WEBHOOK_SECRET. Workers-safe (single fetch to the Bot API), and
 * fail-open: when TELEGRAM_BOT_TOKEN is unset the webhook no-ops cleanly.
 *
 * One-time webhook registration (run once after deploy):
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
 *     -d url="https://tezmotors.uz/api/bot/telegram" \
 *     -d secret_token="<TELEGRAM_WEBHOOK_SECRET>"
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyNewInquiry } from "@/lib/notify";
import { runAssistantTurn, markConversationHandoff } from "@/lib/assistant-runtime";
import { normalizePhone } from "@/lib/customer-auth";
import { escapeHtml } from "@/lib/escape-html";
import { timingSafeEqual } from "@/lib/timing-safe";
import { logEvent } from "@/lib/error-report";
import type { Car } from "@/types/car";

const TG_API = "https://api.telegram.org";

type BotLocale = "ru" | "uz" | "en";

interface TgUser {
  first_name?: string;
  language_code?: string;
}
interface TgContact {
  phone_number?: string;
  first_name?: string;
}
interface TgMessage {
  chat?: { id: number };
  from?: TgUser;
  text?: string;
  contact?: TgContact;
}
interface TgUpdate {
  message?: TgMessage;
}

interface ReplyMarkup {
  inline_keyboard?: { text: string; url?: string; web_app?: { url: string } }[][];
  keyboard?: { text: string; request_contact?: boolean }[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
}

/** Inline keyboard with a Telegram Mini App launch button (web_app). Requires
 *  the bot's domain to be configured in BotFather; see HANDOFF.md. */
function appButton(locale: BotLocale): ReplyMarkup {
  const label = locale === "uz" ? "🚗 Ilovani ochish" : locale === "en" ? "🚗 Open the app" : "🚗 Открыть приложение";
  return { inline_keyboard: [[{ text: label, web_app: { url: `${siteUrl()}/${locale}/app` } }]] };
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://tezmotors.uz").replace(/\/$/, "");
}

function botLocale(code?: string): BotLocale {
  const c = (code || "").toLowerCase();
  if (c.startsWith("uz")) return "uz";
  if (c.startsWith("en")) return "en";
  return "ru";
}

// A message is treated as a phone only if, once formatting is stripped, it is
// purely 9–15 digits — so a budget like "до 25000000" (has letters) stays a query.
function looksLikePhone(s: string): boolean {
  const cleaned = s.replace(/[\s+\-()]/g, "");
  return /^\d{9,15}$/.test(cleaned);
}

async function tgSend(chatId: number, text: string, replyMarkup?: ReplyMarkup): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`${TG_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });
  } catch {
    // fail-open
  }
}

/**
 * Send the recommended cars as photos (visual cards convert far better than a
 * text list). Up to 3, as a media group (or a single sendPhoto). Additive to
 * the text reply + link buttons; fail-open and silent when cars have no images.
 */
async function tgSendCarPhotos(chatId: number, cars: Car[]): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const items = cars
    .slice(0, 3)
    .map((c) => ({ c, img: Array.isArray(c.images) ? c.images[0] : undefined }))
    .filter((x): x is { c: Car; img: string } => typeof x.img === "string" && x.img.length > 0);
  if (items.length === 0) return;
  const caption = ({ c }: { c: Car }) => `${c.brand} ${c.model} ${c.year} — $${c.price_usd.toLocaleString("en-US")}`;
  try {
    if (items.length === 1) {
      await fetch(`${TG_API}/bot${token}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, photo: items[0].img, caption: caption(items[0]) }),
      });
    } else {
      const media = items.map((x) => ({ type: "photo", media: x.img, caption: caption(x) }));
      await fetch(`${TG_API}/bot${token}/sendMediaGroup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, media }),
      });
    }
  } catch {
    // fail-open
  }
}

// ---- Localized copy --------------------------------------------------------

const COPY: Record<BotLocale, { welcome: string; nudge: string; thanks: string; share: string }> = {
  ru: {
    welcome:
      "👋 Здравствуйте! Я помогу подобрать авто из наличия Tez Motors.\n\nНапишите, что ищете — например: «семейный кроссовер до $30k» или «электромобиль». Чтобы менеджер связался с вами, нажмите кнопку ниже и поделитесь номером.",
    nudge: "Хотите, чтобы менеджер связался и рассказал про рассрочку? Поделитесь номером кнопкой ниже 👇",
    thanks: "Спасибо! Менеджер свяжется с вами в ближайшее время. 📞",
    share: "📱 Поделиться номером",
  },
  uz: {
    welcome:
      "👋 Assalomu alaykum! Tez Motors omboridan avto tanlashda yordam beraman.\n\nNimani qidirayotganingizni yozing — masalan: «$30k gacha oilaviy krossover» yoki «elektromobil». Menejer bog'lanishi uchun pastdagi tugma orqali raqamingizni ulashing.",
    nudge: "Menejer bog'lanib, bo'lib to'lash haqida aytib bersinmi? Pastdagi tugma orqali raqamingizni ulashing 👇",
    thanks: "Rahmat! Menejer tez orada siz bilan bog'lanadi. 📞",
    share: "📱 Raqamni ulashish",
  },
  en: {
    welcome:
      "👋 Hi! I'll help you pick a car from Tez Motors stock.\n\nTell me what you're looking for — e.g. \"family SUV under $30k\" or \"electric car\". To have a manager reach out, tap the button below and share your number.",
    nudge: "Want a manager to reach out and explain installments? Share your number with the button below 👇",
    thanks: "Thank you! A manager will contact you shortly. 📞",
    share: "📱 Share my number",
  },
};

function contactKeyboard(locale: BotLocale): ReplyMarkup {
  return {
    keyboard: [[{ text: COPY[locale].share, request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

function carButtons(cars: Car[], locale: BotLocale): ReplyMarkup | undefined {
  const rows = cars.slice(0, 3).map((c) => [
    {
      text: `${c.brand} ${c.model} ${c.year} — $${c.price_usd.toLocaleString("en-US")}`,
      url: `${siteUrl()}/${locale}/catalog/${c.slug}`,
    },
  ]);
  return rows.length > 0 ? { inline_keyboard: rows } : undefined;
}

// ---- Lead capture ----------------------------------------------------------

async function captureLead(
  chatId: number,
  locale: BotLocale,
  lead: { name: string; phone: string },
): Promise<void> {
  const supabase = createServiceClient();
  const phone = normalizePhone(lead.phone) || lead.phone;
  const name = lead.name?.trim() || "Telegram";

  let inquiryId: string | null = null;
  try {
    const { data } = await supabase
      .from("inquiries")
      .insert({
        name,
        phone,
        type: "car_inquiry",
        message: "Telegram bot lead",
        source_page: "telegram-bot",
        metadata: { channel: "telegram", chat_id: chatId },
        status: "new",
      })
      .select("id")
      .single();
    inquiryId = (data?.id as string) || null;
  } catch {
    /* fail-open */
  }

  // Mark the AI conversation as handed off so the dealer sees the hot lead.
  markConversationHandoff(supabase, "telegram", chatId, { name, phone, inquiryId }).catch(() => {});

  notifyNewInquiry({
    name,
    phone,
    type: "car_inquiry",
    message: "Telegram bot lead",
    source_page: "telegram-bot",
    metadata: { channel: "telegram", chat_id: chatId },
    locale,
  }).catch(() => {});

  await tgSend(chatId, COPY[locale].thanks);
}

// ---- Update handling -------------------------------------------------------

async function handleUpdate(update: TgUpdate): Promise<void> {
  const message = update.message;
  if (!message || !message.chat) return;
  const chatId = message.chat.id;
  const from = message.from || {};
  const locale = botLocale(from.language_code);

  // 1) Shared contact → qualified lead.
  if (message.contact && message.contact.phone_number) {
    await captureLead(chatId, locale, {
      name: message.contact.first_name || from.first_name || "Telegram",
      phone: message.contact.phone_number,
    });
    return;
  }

  const text = (message.text || "").trim();
  if (!text) return;

  // 2) /start → welcome + share-contact keyboard, then a Mini App launch button.
  if (text === "/start" || text.startsWith("/start")) {
    await tgSend(chatId, COPY[locale].welcome, contactKeyboard(locale));
    const appPrompt =
      locale === "uz"
        ? "Yoki butun katalogni shu yerda ko'ring 👇"
        : locale === "en"
        ? "Or browse the whole catalog right here 👇"
        : "Или посмотрите весь каталог прямо здесь 👇";
    await tgSend(chatId, appPrompt, appButton(locale));
    return;
  }

  // 3) Typed phone number → lead.
  if (looksLikePhone(text)) {
    const normalized = normalizePhone(text);
    if (normalized) {
      await captureLead(chatId, locale, { name: from.first_name || "Telegram", phone: normalized });
      return;
    }
  }

  // 4) Free text → grounded recommendation + qualification (shared closer
  //    runtime: multi-turn memory, profile, nudges, dealer oversight).
  const supabase = createServiceClient();
  const { reply, cars } = await runAssistantTurn(supabase, {
    channel: "telegram",
    externalKey: chatId,
    message: text,
    locale,
    knownName: from.first_name || null,
  });
  await tgSend(chatId, escapeHtml(reply), carButtons(cars, locale) ?? contactKeyboard(locale));
  await tgSendCarPhotos(chatId, cars);
}

export async function POST(request: NextRequest) {
  // Fail-open: no token means the bot isn't configured — accept and ignore so
  // Telegram doesn't retry-storm a half-set-up webhook.
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ ok: true });
  }

  // Verify the secret header Telegram echoes from setWebhook. Locked: a missing
  // or wrong header (or an unset secret) is rejected. Constant-time compare.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const header = request.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || !timingSafeEqual(header || "", secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Defense in depth: cap the body even after auth. Telegram updates are tiny;
  // 256 KB is generous headroom and rejects a leaked-secret abuse / runaway.
  const MAX_BODY = 256 * 1024;
  const cl = Number(request.headers.get("content-length") || 0);
  if (cl && cl > MAX_BODY) {
    return NextResponse.json({ ok: false, error: "payload too large" }, { status: 413 });
  }

  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    await handleUpdate(update);
  } catch (err) {
    logEvent("bot.telegram.error", { message: err instanceof Error ? err.message : String(err) }, "error");
  }
  // Always 200 so Telegram considers the update delivered.
  return NextResponse.json({ ok: true });
}
