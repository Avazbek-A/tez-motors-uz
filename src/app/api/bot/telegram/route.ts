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
import { runCopilotTurn } from "@/lib/copilot/core";
import { normalizePhone } from "@/lib/customer-auth";
import { escapeHtml } from "@/lib/escape-html";
import { timingSafeEqual } from "@/lib/timing-safe";
import { logEvent } from "@/lib/error-report";
import { reserveCarAndCreateOrder } from "@/lib/reservation";
import { resolveReplyLocale } from "@/lib/detect-locale";
import { customsStart, customsStep, customsPriceReply, isCustomsTrigger, CUST_MARKER } from "@/lib/customs-bot-flow";
import { getUsdUzsRate } from "@/lib/fx-rate";
import { getSiteSettings } from "@/lib/site-settings-server";
import { handleCrmCallback, handleCrmCustomerLookup, handleCrmSearch, CRM_CUST_MARKER, CRM_SEARCH_MARKER } from "@/lib/bot/operator-crm";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { logRecording } from "@/lib/call-recording";
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
interface TgFile {
  file_id: string;
  mime_type?: string;
  file_name?: string;
  duration?: number;
  file_size?: number;
}
interface TgMessage {
  chat?: { id: number };
  from?: TgUser;
  text?: string;
  caption?: string;
  contact?: TgContact;
  reply_to_message?: { text?: string };
  voice?: TgFile;
  audio?: TgFile;
  document?: TgFile;
}
interface TgCallbackQuery {
  id: string;
  from?: TgUser;
  message?: { chat?: { id: number }; message_id?: number };
  data?: string;
}
interface TgUpdate {
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

interface ReplyMarkup {
  inline_keyboard?: { text: string; url?: string; web_app?: { url: string }; callback_data?: string }[][];
  keyboard?: { text: string; request_contact?: boolean }[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  force_reply?: boolean;
  input_field_placeholder?: string;
}

/** Inline keyboard with a Telegram Mini App launch button (web_app). Requires
 *  the bot's domain to be configured in BotFather; see HANDOFF.md. */
function appButton(locale: BotLocale): ReplyMarkup {
  const label = locale === "uz" ? "🚗 Ilovani ochish" : locale === "en" ? "🚗 Open the app" : "🚗 Открыть приложение";
  const customs = locale === "uz" ? "🧮 Rastamojkani hisoblash" : locale === "en" ? "🧮 Estimate customs" : "🧮 Рассчитать растаможку";
  return { inline_keyboard: [
    [{ text: label, web_app: { url: `${siteUrl()}/${locale}/app` } }],
    [{ text: customs, callback_data: "cu|go" }],
  ] };
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://tezmotors.uz").replace(/\/$/, "");
}

/** Dealer-only allow-list (TELEGRAM_OPERATOR_CHAT_IDS, comma-separated chat ids).
 *  An operator chat runs the Dealer Copilot, NOT the customer recommender. */
function isOperatorChat(chatId: number): boolean {
  const ids = (process.env.TELEGRAM_OPERATOR_CHAT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return ids.includes(String(chatId));
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

/** Download a Telegram file (voice/audio/document) by file_id → bytes. */
async function tgDownloadFile(fileId: string): Promise<Buffer | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const meta = await fetch(`${TG_API}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`).then((r) => r.json());
    const path = meta?.result?.file_path;
    if (!path) return null;
    const res = await fetch(`${TG_API}/file/bot${token}/${path}`);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Dealer forwards a call recording to the bot → log it to the CRM. Telegram's upload
 * is robust on flaky connections (the phone uploads to Telegram; the bot fetches
 * server-to-server), so this is the reliable channel vs a direct HTTP upload. Add the
 * customer's phone as the message CAPTION to auto-link the call to their inquiry.
 * Fire-and-forget from handleMessage so the webhook acks Telegram fast.
 */
async function handleOperatorRecording(chatId: number, file: TgFile, caption?: string): Promise<void> {
  // Telegram Bot API getFile downloads cap at 20 MB — bail early with a clear note.
  if (file.file_size && file.file_size > 20 * 1024 * 1024) {
    await tgSend(chatId, "❌ Запись больше 20 МБ — Telegram-бот не может её скачать. Отправьте более короткую запись (или пришлите текст расшифровки звонка).");
    return;
  }
  await tgSend(chatId, "⏳ Обрабатываю запись звонка…");
  const bytes = await tgDownloadFile(file.file_id);
  if (!bytes || bytes.byteLength === 0) {
    await tgSend(chatId, "❌ Не удалось скачать запись из Telegram. Попробуйте отправить ещё раз.");
    return;
  }
  const capRaw = (caption || "").trim();
  const phone = capRaw && looksLikePhone(capRaw) ? (normalizePhone(capRaw) || capRaw) : "";
  try {
    const { analysis, language } = await logRecording({
      audioBuffer: bytes,
      audioType: file.mime_type || "audio/ogg",
      audioName: file.file_name || "telegram-call.ogg",
      phone,
      direction: "outbound",
      durationSec: file.duration || 0,
      awaitEnrich: true,
    });
    const m = analysis?.metadata;
    const langLabel = language
      ? language === "ru" ? "🇷🇺 Русский" : language === "uz" ? "🇺🇿 O'zbek" : language === "en" ? "🇬🇧 English" : language.toUpperCase()
      : "";
    const lines = [
      "📞 <b>Запись звонка добавлена в CRM</b>",
      "",
      analysis?.summary ? escapeHtml(analysis.summary) : "Запись сохранена, расшифровка в обработке.",
      "",
      `👤 Клиент: ${phone ? escapeHtml(phone) : "не указан — добавьте номер в подпись к записи, чтобы привязать к клиенту"}`,
      m ? `📊 Вероятность сделки: ${m.extracted_entities?.closing_probability ?? "—"}%  ·  Тон: ${escapeHtml(m.sentiment || "—")}` : "",
      langLabel ? `🗣 Язык: ${langLabel}` : "",
      `🔗 <a href="${siteUrl()}/admin/calls/recordings">Открыть записи в CRM</a>`,
    ].filter(Boolean);
    await tgSend(chatId, lines.join("\n"));
  } catch (e) {
    await tgSend(chatId, "❌ Не удалось обработать запись: " + escapeHtml((e as Error).message || "ошибка"));
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
  const reserve = locale === "uz" ? "Band qilish" : locale === "en" ? "Reserve" : "Забронировать";
  const rows = cars.slice(0, 3).map((c) => [
    {
      text: `${c.brand} ${c.model} ${c.year} — $${c.price_usd.toLocaleString("en-US")}`,
      url: `${siteUrl()}/${locale}/catalog/${c.slug}?utm_source=telegram`,
    },
    // Transact in chat (Phase AS): reserve this car without leaving Telegram.
    { text: `📝 ${reserve}`, callback_data: `rsv:${c.id}` },
    // Subscribe to a price-drop alert for this car (price-watch-sweep notifies).
    { text: "🔔", callback_data: `pw:${c.id}` },
  ]);
  return rows.length > 0 ? { inline_keyboard: rows } : undefined;
}

// ---- Main menu (client) ----------------------------------------------------
// One clean, discoverable home screen. Buttons map to callbacks handled below;
// the catalog opens the Mini App in-chat.

const MENU: Record<BotLocale, {
  title: string; catalog: string; find: string; customs: string; track: string;
  contacts: string; manager: string; language: string; help: string;
  findPrompt: string; trackText: string; trackBtn: string; pickLang: string;
}> = {
  ru: {
    title: "🚗 <b>Tez Motors</b> — импорт авто из Китая «под ключ».\n\nВыберите нужный раздел 👇",
    catalog: "🚗 Каталог авто", find: "🔎 Подобрать авто", customs: "🧮 Растаможка",
    track: "📦 Мой заказ", contacts: "📍 Контакты", manager: "📞 Менеджер",
    language: "🌐 Язык", help: "ℹ️ Помощь",
    findPrompt: "Опишите, что ищете — например: «семейный кроссовер до $30 000», «электромобиль» или «Tank 300». Подберу из наличия с ценой и фото.",
    trackText: "Проверьте статус заказа по кнопке ниже — понадобится номер TM-… и телефон.",
    trackBtn: "Открыть мой заказ", pickLang: "🌐 Выберите язык / Tilni tanlang / Choose language:",
  },
  uz: {
    title: "🚗 <b>Tez Motors</b> — Xitoydan «kalit topshirish» tamoyilida avto import.\n\nKerakli bo'limni tanlang 👇",
    catalog: "🚗 Avto katalogi", find: "🔎 Avto tanlash", customs: "🧮 Rastamojka",
    track: "📦 Buyurtmam", contacts: "📍 Kontaktlar", manager: "📞 Menejer",
    language: "🌐 Til", help: "ℹ️ Yordam",
    findPrompt: "Nimani qidirayotganingizni yozing — masalan: «$30 000 gacha oilaviy krossover», «elektromobil» yoki «Tank 300». Ombordan narxi va rasmi bilan tanlab beraman.",
    trackText: "Buyurtma holatini pastdagi tugma orqali ko'ring — TM-… raqami va telefon kerak bo'ladi.",
    trackBtn: "Buyurtmamni ochish", pickLang: "🌐 Выберите язык / Tilni tanlang / Choose language:",
  },
  en: {
    title: "🚗 <b>Tez Motors</b> — turnkey car import from China.\n\nChoose what you need 👇",
    catalog: "🚗 Car catalog", find: "🔎 Find a car", customs: "🧮 Customs",
    track: "📦 My order", contacts: "📍 Contacts", manager: "📞 Manager",
    language: "🌐 Language", help: "ℹ️ Help",
    findPrompt: "Describe what you're looking for — e.g. \"family SUV under $30,000\", \"electric car\" or \"Tank 300\". I'll match from stock with price and photos.",
    trackText: "Check your order status with the button below — you'll need your TM-… reference and phone.",
    trackBtn: "Open my order", pickLang: "🌐 Выберите язык / Tilni tanlang / Choose language:",
  },
};

function mainMenu(locale: BotLocale): { text: string; markup: ReplyMarkup } {
  const m = MENU[locale];
  return {
    text: m.title,
    markup: { inline_keyboard: [
      [{ text: m.catalog, web_app: { url: `${siteUrl()}/${locale}/app` } }],
      [{ text: m.find, callback_data: "m|find" }, { text: m.customs, callback_data: "cu|go" }],
      [{ text: m.track, callback_data: "m|track" }, { text: m.manager, callback_data: "m|mgr" }],
      [{ text: m.contacts, callback_data: "m|contacts" }, { text: m.language, callback_data: "m|lang" }],
      [{ text: m.help, callback_data: "m|help" }],
    ] },
  };
}

function langKeyboard(): ReplyMarkup {
  return { inline_keyboard: [[
    { text: "🇷🇺 Русский", callback_data: "lang|ru" },
    { text: "🇺🇿 O'zbek", callback_data: "lang|uz" },
    { text: "🇬🇧 English", callback_data: "lang|en" },
  ]] };
}

const HELP: Record<BotLocale, string> = {
  ru: [
    "ℹ️ <b>Что умеет бот</b>", "",
    "🔎 Просто напишите, какое авто ищете — подберу из наличия с ценами и фото.",
    "🚗 /catalog — весь каталог в приложении",
    "🧮 /customs — калькулятор растаможки",
    "📦 /track — статус вашего заказа",
    "📍 /contacts — адрес, телефон, часы работы",
    "🌐 /language — сменить язык",
    "📋 /menu — главное меню", "",
    "📞 Чтобы менеджер перезвонил — откройте «Менеджер» в меню и поделитесь номером.",
  ].join("\n"),
  uz: [
    "ℹ️ <b>Bot imkoniyatlari</b>", "",
    "🔎 Qanday avto kerakligini yozing — ombordan narxi va rasmi bilan tanlayman.",
    "🚗 /catalog — to'liq katalog ilovada",
    "🧮 /customs — rastamojka kalkulyatori",
    "📦 /track — buyurtmangiz holati",
    "📍 /contacts — manzil, telefon, ish vaqti",
    "🌐 /language — tilni o'zgartirish",
    "📋 /menu — bosh menyu", "",
    "📞 Menejer qo'ng'iroq qilishi uchun menyudagi «Menejer»ni bosing va raqamingizni ulashing.",
  ].join("\n"),
  en: [
    "ℹ️ <b>What this bot can do</b>", "",
    "🔎 Just type what car you want — I'll match from stock with prices and photos.",
    "🚗 /catalog — full catalog in the app",
    "🧮 /customs — customs duty calculator",
    "📦 /track — your order status",
    "📍 /contacts — address, phone, hours",
    "🌐 /language — change language",
    "📋 /menu — main menu", "",
    "📞 For a callback — tap “Manager” in the menu and share your number.",
  ].join("\n"),
};

/** Live contacts card from site_settings (falls back to SITE_CONFIG). */
async function contactsCard(locale: BotLocale): Promise<{ text: string; markup?: ReplyMarkup }> {
  const s = await getSiteSettings();
  const L = {
    ru: { title: "📍 <b>Контакты Tez Motors</b>", hours: "🕒 Часы работы", map: "🗺 На карте", channel: "📣 Наш канал" },
    uz: { title: "📍 <b>Tez Motors kontaktlari</b>", hours: "🕒 Ish vaqti", map: "🗺 Xaritada", channel: "📣 Bizning kanal" },
    en: { title: "📍 <b>Tez Motors contacts</b>", hours: "🕒 Hours", map: "🗺 On the map", channel: "📣 Our channel" },
  }[locale];
  const lines = [
    L.title, "",
    s.address ? `🏢 ${escapeHtml(s.address)}` : "",
    s.workingHours ? `${L.hours}: ${escapeHtml(s.workingHours)}` : "",
    s.phone ? `📞 ${escapeHtml(s.phone)}` : "",
    s.email ? `✉️ ${escapeHtml(s.email)}` : "",
  ].filter(Boolean);
  const row: { text: string; url: string }[] = [];
  if (s.whatsapp) row.push({ text: "💬 WhatsApp", url: s.whatsapp });
  if (s.telegram) row.push({ text: "✈️ Telegram", url: s.telegram });
  const row2: { text: string; url: string }[] = [];
  if (s.instagram) row2.push({ text: "📷 Instagram", url: s.instagram });
  if (s.address) row2.push({ text: L.map, url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}` });
  const inline = [row, row2].filter((r) => r.length > 0);
  return { text: lines.join("\n"), markup: inline.length ? { inline_keyboard: inline } : undefined };
}

// ---- Operator (dealer) menu -------------------------------------------------
// Operators work in Russian. Quick-report buttons run the Dealer Copilot.

const OP_QUERY: Record<string, string> = {
  summary: "сводка", money: "сколько денег", demand: "спрос",
  aging: "что залежалось", leads: "новые заявки",
};

function operatorMenu(): { text: string; markup: ReplyMarkup } {
  return {
    text: [
      "🔧 <b>Tez Motors — панель оператора</b>", "",
      "Быстрые отчёты — нажмите кнопку или спросите словами («спрос», «сколько денег»).",
      "Действия требуют подтверждения «да» — напр.: «снизь цену на Tank 300 на 5%», «переведи заказ TM-XXXXXXXX в таможню».",
      "🎙 Перешлите аудио-запись звонка — добавлю в CRM (номер клиента — в подписи).",
    ].join("\n"),
    markup: { inline_keyboard: [
      [{ text: "📊 Сводка", callback_data: "op|summary" }, { text: "💰 Деньги", callback_data: "op|money" }],
      [{ text: "📈 Спрос", callback_data: "op|demand" }, { text: "📦 Залежалось", callback_data: "op|aging" }],
      [{ text: "🔥 Новые заявки", callback_data: "op|leads" }],
      [{ text: "🗂 CRM в чате", callback_data: "crm|home" }, { text: "🌐 Веб-CRM", url: `${siteUrl()}/admin` }],
    ] },
  };
}

/** Best-effort persist a chosen UI language to the linked customer (for proactive
 *  outbound). No row yet → silently skipped; the in-chat menu re-renders regardless. */
async function persistLocale(chatId: number, locale: BotLocale): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("customers").update({ locale }).eq("telegram_id", chatId);
  } catch {
    /* fail-open */
  }
}

/** Ack a callback query so Telegram stops the button's loading spinner. */
async function tgAnswerCallback(callbackId: string, text?: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`${TG_API}/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackId, ...(text ? { text } : {}) }),
    });
  } catch {
    /* fail-open */
  }
}

// Reserve a car straight from a chat button: resolve the customer's phone from
// their linked telegram_id, reserve atomically, and reply with the reference
// code + track/sign deep-links. No phone on file → ask them to share contact.
async function handleReserveCallback(cb: TgCallbackQuery): Promise<void> {
  const chatId = cb.message?.chat?.id;
  const carId = (cb.data || "").slice(4);
  await tgAnswerCallback(cb.id);
  if (!chatId || !/^[a-f0-9-]{8,64}$/i.test(carId)) return;
  const locale = botLocale(cb.from?.language_code);
  const supabase = createServiceClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("name, phone")
    .eq("telegram_id", chatId)
    .maybeSingle();

  if (!customer?.phone) {
    const ask =
      locale === "uz"
        ? "Band qilish uchun avval raqamingizni ulashing 👇"
        : locale === "en"
        ? "To reserve, share your number first 👇"
        : "Чтобы забронировать, сначала поделитесь номером 👇";
    await tgSend(chatId, ask, contactKeyboard(locale));
    return;
  }

  const name = customer.name || cb.from?.first_name || "Telegram";
  const result = await reserveCarAndCreateOrder(supabase, {
    carId,
    name,
    phone: customer.phone,
    locale,
    attribution: { source: "telegram" },
    sourcePage: "telegram-bot",
  });

  if (!result.ok) {
    const taken =
      locale === "uz" ? "Afsus, bu avto allaqachon band qilingan." : locale === "en" ? "Sorry, this car is no longer available." : "К сожалению, это авто уже забронировано.";
    await tgSend(chatId, taken);
    return;
  }

  notifyNewInquiry({
    name,
    phone: customer.phone,
    type: "reservation",
    message: `Reserved in Telegram: ${result.car.brand} ${result.car.model} ${result.car.year}`,
    source_page: "telegram-bot",
    locale,
    metadata: { channel: "telegram", reference_code: result.referenceCode },
  }).catch(() => {});

  const code = result.referenceCode;
  const phoneParam = encodeURIComponent(customer.phone);
  const carName = `${result.car.brand} ${result.car.model} ${result.car.year}`;
  const lines =
    locale === "uz"
      ? [`✅ ${carName} band qilindi!`, code ? `Buyurtma raqami: <b>${escapeHtml(code)}</b>` : ""]
      : locale === "en"
      ? [`✅ ${carName} reserved!`, code ? `Reference: <b>${escapeHtml(code)}</b>` : ""]
      : [`✅ ${carName} забронирован!`, code ? `Номер заказа: <b>${escapeHtml(code)}</b>` : ""];
  const buttons: { text: string; url: string }[] = [];
  if (code) {
    buttons.push({ text: locale === "uz" ? "Holatni kuzatish" : locale === "en" ? "Track order" : "Отследить заказ", url: `${siteUrl()}/${locale}/track?code=${encodeURIComponent(code)}&phone=${phoneParam}` });
    buttons.push({ text: locale === "uz" ? "Shartnomani imzolash" : locale === "en" ? "Sign contract" : "Подписать договор", url: `${siteUrl()}/${locale}/sign?code=${encodeURIComponent(code)}&phone=${phoneParam}` });
  }
  await tgSend(chatId, lines.filter(Boolean).join("\n"), buttons.length ? { inline_keyboard: [buttons] } : undefined);
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

  // Link this Telegram identity to a customer record keyed on the shared phone,
  // so future proactive messages (order status, price drops) can reach them on
  // Telegram first (chat-first, Phase AI). In a private chat the chat id IS the
  // user id. Best-effort + fail-open: a telegram_id already bound to another
  // customer (UNIQUE) simply leaves the link unset.
  try {
    const { data: existing } = await supabase
      .from("customers")
      .select("id, telegram_id")
      .eq("phone", phone)
      .maybeSingle();
    if (existing) {
      if (!existing.telegram_id) {
        await supabase.from("customers").update({ telegram_id: chatId }).eq("id", existing.id);
      }
    } else {
      await supabase
        .from("customers")
        .insert({ phone, telegram_id: chatId, name, locale, last_login_at: new Date().toISOString() });
    }
  } catch {
    /* unique race / telegram_id already linked elsewhere — fail-open */
  }

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
    inquiryId: inquiryId ?? undefined,
  }).catch(() => {});

  await tgSend(chatId, COPY[locale].thanks);
}

// ---- Update handling -------------------------------------------------------

// Customs ("растаможка") wizard — stateless inline-button flow. Each callback
// advances a step; the final price step is a force_reply (see customs-bot-flow).
async function handleCustomsCallback(cb: TgCallbackQuery): Promise<void> {
  const chatId = cb.message?.chat?.id;
  await tgAnswerCallback(cb.id);
  if (!chatId || typeof cb.data !== "string") return;
  const locale = botLocale(cb.from?.language_code);
  const step = cb.data === "cu|go" ? customsStart(locale) : customsStep(cb.data, locale);
  if (!step) return;
  // Commercial/complex types (truck/engine/fura/bus) → capture a declarant-quote lead.
  if (step.lead) await tgSend(chatId, step.text, contactKeyboard(locale));
  else await tgSend(chatId, step.text, step.replyMarkup as ReplyMarkup);
}

// ---- Smarter Find-a-car: quick picks → the recommender ---------------------
const FIND_PICKS: Record<BotLocale, { title: string; rows: { text: string; callback_data: string }[][] }> = {
  ru: { title: "🔎 Выберите категорию — или просто опишите, что ищете, текстом 👇", rows: [
    [{ text: "🔋 Электро", callback_data: "find|ev" }, { text: "🚙 Кроссовер", callback_data: "find|suv" }],
    [{ text: "👨‍👩‍👧 Семейный", callback_data: "find|family" }, { text: "💎 Премиум", callback_data: "find|premium" }],
    [{ text: "💰 До $20 000", callback_data: "find|budget" }, { text: "🏎 Седан", callback_data: "find|sedan" }],
  ] },
  uz: { title: "🔎 Toifani tanlang — yoki shunchaki nimani qidirayotganingizni yozing 👇", rows: [
    [{ text: "🔋 Elektro", callback_data: "find|ev" }, { text: "🚙 Krossover", callback_data: "find|suv" }],
    [{ text: "👨‍👩‍👧 Oilaviy", callback_data: "find|family" }, { text: "💎 Premium", callback_data: "find|premium" }],
    [{ text: "💰 $20 000 gacha", callback_data: "find|budget" }, { text: "🏎 Sedan", callback_data: "find|sedan" }],
  ] },
  en: { title: "🔎 Pick a category — or just type what you're looking for 👇", rows: [
    [{ text: "🔋 Electric", callback_data: "find|ev" }, { text: "🚙 SUV", callback_data: "find|suv" }],
    [{ text: "👨‍👩‍👧 Family", callback_data: "find|family" }, { text: "💎 Premium", callback_data: "find|premium" }],
    [{ text: "💰 Under $20,000", callback_data: "find|budget" }, { text: "🏎 Sedan", callback_data: "find|sedan" }],
  ] },
};
const FIND_QUERY: Record<BotLocale, Record<string, string>> = {
  ru: { ev: "электромобиль", suv: "кроссовер SUV", family: "семейный автомобиль 7 мест", premium: "премиум автомобиль", budget: "автомобиль до 20000 долларов", sedan: "седан" },
  uz: { ev: "elektromobil", suv: "krossover SUV", family: "oilaviy avtomobil 7 o'rin", premium: "premium avtomobil", budget: "20000 dollargacha avtomobil", sedan: "sedan" },
  en: { ev: "electric car", suv: "crossover SUV", family: "family car 7 seats", premium: "premium car", budget: "car under $20000", sedan: "sedan" },
};

async function handleFindCallback(cb: TgCallbackQuery): Promise<void> {
  const chatId = cb.message?.chat?.id;
  await tgAnswerCallback(cb.id);
  if (!chatId) return;
  const locale = botLocale(cb.from?.language_code);
  const query = FIND_QUERY[locale][(cb.data || "").slice(5)];
  if (!query) return;
  const supabase = createServiceClient();
  const { reply, cars } = await runAssistantTurn(supabase, {
    channel: "telegram", externalKey: chatId, message: query, locale, knownName: cb.from?.first_name || null,
  });
  await tgSend(chatId, escapeHtml(reply), carButtons(cars, locale) ?? contactKeyboard(locale));
  await tgSendCarPhotos(chatId, cars);
}

// ---- Price-drop alert: subscribe a linked customer to a car ----------------
async function handlePriceWatchCallback(cb: TgCallbackQuery): Promise<void> {
  const chatId = cb.message?.chat?.id;
  const carId = (cb.data || "").slice(3);
  if (!chatId || !/^[a-f0-9-]{8,64}$/i.test(carId)) { await tgAnswerCallback(cb.id); return; }
  const locale = botLocale(cb.from?.language_code);
  const supabase = createServiceClient();
  const { data: customer } = await supabase.from("customers").select("id, phone").eq("telegram_id", chatId).maybeSingle();
  if (!customer?.phone) {
    await tgAnswerCallback(cb.id);
    const ask = locale === "uz" ? "Narx tushishi haqida xabar olish uchun avval raqamingizni ulashing 👇"
      : locale === "en" ? "To get a price-drop alert, share your number first 👇"
      : "Чтобы получать уведомление о снижении цены, поделитесь номером 👇";
    await tgSend(chatId, ask, contactKeyboard(locale));
    return;
  }
  const { data: existing } = await supabase.from("price_watches").select("id").eq("car_id", carId).eq("customer_id", customer.id).is("notified_at", null).maybeSingle();
  if (existing) {
    await tgAnswerCallback(cb.id, locale === "uz" ? "🔔 Allaqachon obuna bo'lgansiz" : locale === "en" ? "🔔 Already subscribed" : "🔔 Подписка уже активна");
    return;
  }
  const { data: car } = await supabase.from("cars").select("price_usd").eq("id", carId).maybeSingle();
  if (!car) { await tgAnswerCallback(cb.id); return; }
  await supabase.from("price_watches").insert({
    car_id: carId,
    customer_id: customer.id,
    email: `tg+${String(customer.phone).replace(/\D/g, "")}@tezmotors.local`,
    target_price_usd: car.price_usd,
  });
  await tgAnswerCallback(cb.id, locale === "uz" ? "🔔 Narx tushsa — xabar beramiz!" : locale === "en" ? "🔔 We'll alert you on a price drop!" : "🔔 Уведомим, как только цена снизится!");
}

// ---- Client self-service: My orders ----------------------------------------
async function handleMyOrders(chatId: number, locale: BotLocale): Promise<void> {
  const supabase = createServiceClient();
  const { data: customer } = await supabase.from("customers").select("phone").eq("telegram_id", chatId).maybeSingle();
  if (!customer?.phone) {
    await tgSend(chatId, MENU[locale].trackText, { inline_keyboard: [[{ text: MENU[locale].trackBtn, url: `${siteUrl()}/${locale}/track` }]] });
    return;
  }
  const { data: orders } = await supabase
    .from("orders")
    .select("reference_code, status, created_at")
    .eq("customer_phone", customer.phone)
    .order("created_at", { ascending: false })
    .limit(10);
  if (!orders?.length) {
    const none = locale === "uz" ? "Sizda hali buyurtmalar yo'q. Katalogdan avto tanlang 👇"
      : locale === "en" ? "You have no orders yet. Pick a car from the catalog 👇"
      : "У вас пока нет заказов. Выберите авто в каталоге 👇";
    await tgSend(chatId, none, appButton(locale));
    return;
  }
  const labels = ORDER_STATUS_LABELS[locale];
  const phoneParam = encodeURIComponent(customer.phone);
  const head = locale === "uz" ? "📦 <b>Buyurtmalaringiz</b>" : locale === "en" ? "📦 <b>Your orders</b>" : "📦 <b>Ваши заказы</b>";
  const rows = orders.map((o) => [{
    text: `📦 ${o.reference_code} · ${labels[o.status as string] || o.status}`,
    url: `${siteUrl()}/${locale}/track?code=${encodeURIComponent(o.reference_code as string)}&phone=${phoneParam}`,
  }]);
  await tgSend(chatId, head, { inline_keyboard: rows });
}

// Client main-menu buttons (m|…) and the language switch (lang|…).
async function handleMenuCallback(cb: TgCallbackQuery): Promise<void> {
  const chatId = cb.message?.chat?.id;
  await tgAnswerCallback(cb.id);
  if (!chatId) return;
  const data = cb.data || "";
  let locale = botLocale(cb.from?.language_code);

  if (data.startsWith("lang|")) {
    const picked = data.slice(5);
    locale = picked === "uz" ? "uz" : picked === "en" ? "en" : "ru";
    await persistLocale(chatId, locale);
    const menu = mainMenu(locale);
    await tgSend(chatId, menu.text, menu.markup);
    return;
  }

  switch (data.slice(2)) {
    case "find":
      await tgSend(chatId, FIND_PICKS[locale].title, { inline_keyboard: FIND_PICKS[locale].rows });
      return;
    case "mgr":
      await tgSend(chatId, COPY[locale].nudge, contactKeyboard(locale));
      return;
    case "track":
      await handleMyOrders(chatId, locale);
      return;
    case "contacts": {
      const c = await contactsCard(locale);
      await tgSend(chatId, c.text, c.markup);
      return;
    }
    case "lang":
      await tgSend(chatId, MENU[locale].pickLang, langKeyboard());
      return;
    case "help":
      await tgSend(chatId, HELP[locale]);
      return;
    default: {
      const menu = mainMenu(locale);
      await tgSend(chatId, menu.text, menu.markup);
    }
  }
}

// Operator quick-report buttons (op|…) → run the Dealer Copilot.
async function handleOperatorCallback(cb: TgCallbackQuery): Promise<void> {
  const chatId = cb.message?.chat?.id;
  const key = (cb.data || "").slice(3);
  await tgAnswerCallback(cb.id);
  if (!chatId || !OP_QUERY[key]) return;
  const supabase = createServiceClient();
  const turn = await runCopilotTurn({ supabase, threadId: `tg:${chatId}`, message: OP_QUERY[key] });
  await tgSend(chatId, escapeHtml(turn.reply));
}

async function handleUpdate(update: TgUpdate): Promise<void> {
  // Inline-button callbacks (Phase AS — reserve in chat). Operator confirm
  // callbacks are handled elsewhere; here we only act on customer "rsv:" data.
  if (update.callback_query) {
    const cb = update.callback_query;
    const cbChat = cb.message?.chat?.id ?? 0;
    const data = typeof cb.data === "string" ? cb.data : "";
    if (isOperatorChat(cbChat)) {
      if (data.startsWith("op|")) await handleOperatorCallback(cb);
      else if (data.startsWith("crm|")) await handleCrmCallback(createServiceClient(), cb);
      else await tgAnswerCallback(cb.id);
      return;
    }
    if (data.startsWith("rsv:")) await handleReserveCallback(cb);
    else if (data.startsWith("cu|")) await handleCustomsCallback(cb);
    else if (data.startsWith("find|")) await handleFindCallback(cb);
    else if (data.startsWith("pw:")) await handlePriceWatchCallback(cb);
    else if (data.startsWith("m|") || data.startsWith("lang|")) await handleMenuCallback(cb);
    else await tgAnswerCallback(cb.id);
    return;
  }

  const message = update.message;
  if (!message || !message.chat) return;
  const chatId = message.chat.id;
  const from = message.from || {};
  const locale = botLocale(from.language_code);

  // 0) OPERATOR (dealer) branch — gated to the allow-list. Runs the Dealer
  //    Copilot (ask + confirm-gated actions), NOT the customer recommender.
  if (isOperatorChat(chatId)) {
    // Forwarded call recording (voice / audio / audio-document) → log to the CRM.
    // The reliable channel: Telegram handles the upload; the bot fetches it server-side.
    const rec =
      message.voice ||
      message.audio ||
      (message.document && /^audio\//i.test(message.document.mime_type || "") ? message.document : null);
    if (rec) {
      void handleOperatorRecording(chatId, rec, message.caption).catch(() => {});
      return;
    }
    const opText = (message.text || "").trim().slice(0, 1000);
    if (!opText) return;
    // CRM force_reply flows — the prompt text carries a marker we match here.
    if (message.reply_to_message?.text?.includes(CRM_CUST_MARKER)) {
      await handleCrmCustomerLookup(createServiceClient(), chatId, opText);
      return;
    }
    if (message.reply_to_message?.text?.includes(CRM_SEARCH_MARKER)) {
      await handleCrmSearch(createServiceClient(), chatId, opText);
      return;
    }
    // /start, /menu, /help or any unknown slash command → the operator dashboard.
    const opCmd = opText.startsWith("/") ? opText.slice(1).split(/[@\s]/)[0].toLowerCase() : "";
    if (opCmd && !OP_QUERY[opCmd]) {
      const om = operatorMenu();
      await tgSend(chatId, om.text, om.markup);
      return;
    }
    // A quick-report command maps to a Copilot query; free text passes through verbatim.
    const opQuery = opCmd ? OP_QUERY[opCmd] : opText;
    const supabaseOp = createServiceClient();
    const turn = await runCopilotTurn({ supabase: supabaseOp, threadId: `tg:${chatId}`, message: opQuery });
    await tgSend(chatId, escapeHtml(turn.reply));
    return;
  }

  // 1) Shared contact → qualified lead.
  if (message.contact && message.contact.phone_number) {
    await captureLead(chatId, locale, {
      name: message.contact.first_name || from.first_name || "Telegram",
      phone: message.contact.phone_number,
    });
    return;
  }

  // Cap at 500 chars (same as the web assistant) — bounds LLM token cost on
  // pasted walls of text and limits the surface for prompt-injection attempts.
  const text = (message.text || "").trim().slice(0, 500);
  if (!text) return;

  // 1.5) Customs wizard — a reply to the price prompt carries the embedded state
  //      [cu:kind|age|origin|cc], so we compute statelessly (no per-chat row).
  if (message.reply_to_message?.text && CUST_MARKER.test(message.reply_to_message.text)) {
    const usdUzs = await getUsdUzsRate(createServiceClient()).catch(() => 12600);
    const step = customsPriceReply(message.reply_to_message.text, text, locale, usdUzs);
    if (step) { await tgSend(chatId, step.text, step.replyMarkup as ReplyMarkup); return; }
  }

  // 2) Slash commands → a discoverable, professional menu. The full list is
  //    registered with Telegram via setMyCommands (scripts/set-bot-commands.mjs)
  //    so it shows in the "/" menu; here we render each one.
  if (text.startsWith("/")) {
    const cmd = text.slice(1).split(/[@\s]/)[0].toLowerCase();
    const menu = mainMenu(locale);
    switch (cmd) {
      case "start": {
        const greet = locale === "uz" ? "Assalomu alaykum" : locale === "en" ? "Welcome" : "Здравствуйте";
        const hi = from.first_name ? `👋 ${greet}, ${escapeHtml(from.first_name)}!\n\n` : "";
        await tgSend(chatId, hi + menu.text, menu.markup);
        return;
      }
      case "menu":
        await tgSend(chatId, menu.text, menu.markup);
        return;
      case "help":
        await tgSend(chatId, HELP[locale]);
        return;
      case "catalog":
        await tgSend(chatId, MENU[locale].catalog, appButton(locale));
        return;
      case "track":
        await tgSend(chatId, MENU[locale].trackText, {
          inline_keyboard: [[{ text: MENU[locale].trackBtn, url: `${siteUrl()}/${locale}/track` }]],
        });
        return;
      case "contacts": {
        const c = await contactsCard(locale);
        await tgSend(chatId, c.text, c.markup);
        return;
      }
      case "language":
      case "lang":
        await tgSend(chatId, MENU[locale].pickLang, langKeyboard());
        return;
      case "customs":
      case "rastamozhka":
        break; // handled by the customs wizard below (3.5)
      default:
        await tgSend(chatId, menu.text, menu.markup);
        return;
    }
  }

  // 3) Typed phone number → lead.
  if (looksLikePhone(text)) {
    const normalized = normalizePhone(text);
    if (normalized) {
      await captureLead(chatId, locale, { name: from.first_name || "Telegram", phone: normalized });
      return;
    }
  }

  // 3.5) Customs wizard — explicit command or a "растаможка" mention opens it
  //      (a no-forced-sub-gate competitor to @autodeklarantbot).
  if (text.startsWith("/rastamozhka") || text.startsWith("/customs") || isCustomsTrigger(text)) {
    const s = customsStart(resolveReplyLocale(text, locale));
    await tgSend(chatId, s.text, s.replyMarkup as ReplyMarkup);
    return;
  }

  // 4) Free text → grounded recommendation + qualification (shared closer
  //    runtime: multi-turn memory, profile, nudges, dealer oversight).
  //    Reply in the language the customer actually WROTE in — not their Telegram
  //    UI language (a RU speaker with an English Telegram was getting English).
  const replyLocale = resolveReplyLocale(text, locale);
  const supabase = createServiceClient();
  const { reply, cars } = await runAssistantTurn(supabase, {
    channel: "telegram",
    externalKey: chatId,
    message: text,
    locale: replyLocale,
    knownName: from.first_name || null,
  });
  await tgSend(chatId, escapeHtml(reply), carButtons(cars, replyLocale) ?? contactKeyboard(replyLocale));
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
