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
import { handleCrmCallback, handleCrmCustomerLookup, handleCrmSearch, handleCrmReply, handleCrmNote, CRM_CUST_MARKER, CRM_SEARCH_MARKER, CRM_REPLY_MARKER, CRM_NOTE_MARKER } from "@/lib/bot/operator-crm";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { logRecording } from "@/lib/call-recording";
import { transcribeAudio } from "@/lib/whisper";
import { createRateLimiter } from "@/lib/rate-limit";
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

/** Fire-and-forget bot funnel event (analytics). Never blocks the webhook. */
function trackBot(chatId: number, event: string, detail?: Record<string, unknown>): void {
  try {
    void createServiceClient().from("bot_events").insert({ chat_id: chatId, event, detail: detail ?? null }).then(() => {}, () => {});
  } catch {
    /* fail-open */
  }
}

// Cap LLM-backed messages per chat (cost + abuse). In-memory is fine: prod is a
// single long-lived Node server. Generous for real customers; throttles bursts.
const botLimiter = createRateLimiter({ max: 20, windowMs: 10 * 60 * 1000, maxEntries: 5000 });
/** True if this chat may make another LLM-backed request right now. */
function llmAllowed(chatId: number): boolean {
  return botLimiter(String(chatId));
}
function throttledMsg(locale: BotLocale): string {
  return locale === "uz" ? "⏳ So'rovlar juda ko'p — biroz kuting va qaytadan urinib ko'ring." : locale === "en" ? "⏳ Too many requests — please wait a moment and try again." : "⏳ Слишком много запросов — подождите немного и попробуйте снова.";
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
    // Open a rich in-chat detail card (photo + specs) instead of bouncing to site.
    {
      text: `ℹ️ ${c.brand} ${c.model} ${c.year} — $${c.price_usd.toLocaleString("en-US")}`,
      callback_data: `car:${c.id}`,
    },
    // Transact in chat (Phase AS): reserve this car without leaving Telegram.
    { text: `📝 ${reserve}`, callback_data: `rsv:${c.id}` },
    // Subscribe to a price-drop alert for this car (price-watch-sweep notifies).
    { text: "🔔", callback_data: `pw:${c.id}` },
  ]);
  if (rows.length === 0) return undefined;
  // Refine the SAME result set (the assistant thread keeps context per chat).
  const cheaper = locale === "uz" ? "💰 Arzonroq" : locale === "en" ? "💰 Cheaper" : "💰 Дешевле";
  const pricier = locale === "uz" ? "💎 Premium" : locale === "en" ? "💎 Pricier" : "💎 Дороже";
  const bigger = locale === "uz" ? "📏 Kengroq" : locale === "en" ? "📏 Bigger" : "📏 Просторнее";
  rows.push([
    { text: cheaper, callback_data: "ref|cheaper" },
    { text: pricier, callback_data: "ref|pricier" },
    { text: bigger, callback_data: "ref|bigger" },
  ]);
  // Save this search → the saved-search cron DMs them on new matches.
  const saveLbl = locale === "uz" ? "🔔 Qidiruvni saqlash (yangisi kelsa — xabar)" : locale === "en" ? "🔔 Save search (alert on new matches)" : "🔔 Сохранить поиск (уведомлять о новых)";
  rows.push([{ text: saveLbl, callback_data: "ss|save" }]);
  return { inline_keyboard: rows };
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
      [{ text: locale === "uz" ? "🛠 Xizmatlar" : locale === "en" ? "🛠 Services" : "🛠 Услуги", callback_data: "m|svc" }],
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

  trackBot(chatId, "reserve", { carId });

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
  opts: { type?: string; message?: string } = {},
): Promise<void> {
  const supabase = createServiceClient();
  const phone = normalizePhone(lead.phone) || lead.phone;
  const name = lead.name?.trim() || "Telegram";
  const type = opts.type || "car_inquiry";
  const message = opts.message || "Telegram bot lead";

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
        type,
        message,
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
    type,
    message,
    source_page: "telegram-bot",
    metadata: { channel: "telegram", chat_id: chatId },
    locale,
    inquiryId: inquiryId ?? undefined,
  }).catch(() => {});

  trackBot(chatId, "lead", { type });

  // Turn a qualified car lead into ongoing new-arrival alerts: auto-enroll the
  // customer in the saved-search loop (the cron DMs them Telegram-first on a new
  // match). Conservative — car interest only, a real query, and only if they
  // have no saved search yet (one auto-search per customer; never spammy).
  if (type === "car_inquiry") {
    try {
      const { data: cust } = await supabase.from("customers").select("id").eq("phone", phone).maybeSingle();
      if (cust?.id) {
        const { data: existing } = await supabase.from("saved_searches").select("id").eq("customer_id", cust.id).limit(1).maybeSingle();
        if (!existing) {
          const { data: last } = await supabase
            .from("assistant_messages")
            .select("content")
            .eq("thread_id", `telegram:${chatId}`)
            .eq("role", "user")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const q = String(last?.content || "").trim().slice(0, 120);
          if (q.length >= 4) {
            await supabase.from("saved_searches").insert({ customer_id: cust.id, label: q, filters: { search: q } });
          }
        }
      }
    } catch {
      /* fail-open */
    }
  }

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

// ---- In-chat car detail card -----------------------------------------------
const FUEL: Record<BotLocale, Record<string, string>> = {
  ru: { petrol: "⛽ Бензин", electric: "🔋 Электро", hybrid: "🔌 Гибрид", phev: "🔌 PHEV" },
  uz: { petrol: "⛽ Benzin", electric: "🔋 Elektro", hybrid: "🔌 Gibrid", phev: "🔌 PHEV" },
  en: { petrol: "⛽ Petrol", electric: "🔋 Electric", hybrid: "🔌 Hybrid", phev: "🔌 PHEV" },
};
const BODY: Record<BotLocale, Record<string, string>> = {
  ru: { sedan: "Седан", suv: "Внедорожник", crossover: "Кроссовер", hatchback: "Хэтчбек", minivan: "Минивэн", coupe: "Купе" },
  uz: { sedan: "Sedan", suv: "SUV", crossover: "Krossover", hatchback: "Xetchbek", minivan: "Minivan", coupe: "Kupe" },
  en: { sedan: "Sedan", suv: "SUV", crossover: "Crossover", hatchback: "Hatchback", minivan: "Minivan", coupe: "Coupe" },
};
const UNIT: Record<BotLocale, { km: string; hp: string; seats: string }> = {
  ru: { km: "км", hp: "л.с.", seats: "мест" },
  uz: { km: "km", hp: "o.k.", seats: "o'rin" },
  en: { km: "km", hp: "hp", seats: "seats" },
};

interface CarCardRow {
  id: string; slug: string; brand: string; model: string; year: number;
  price_usd: number; price_uzs: number | null; body_type: string; fuel_type: string;
  engine_power: number | null; range_km: number | null; seats: number | null;
  drivetrain: string | null; mileage: number | null; color: string | null;
  images: string[] | null; inventory_status: string | null;
}

function carCaption(c: CarCardRow, locale: BotLocale): string {
  const u = UNIT[locale];
  const chips = [
    c.engine_power ? `⚡ ${c.engine_power} ${u.hp}` : "",
    c.range_km ? `🔋 ${c.range_km} ${u.km}` : "",
    c.seats ? `👥 ${c.seats} ${u.seats}` : "",
    c.mileage ? `🛣 ${Number(c.mileage).toLocaleString("en-US")} ${u.km}` : "",
  ].filter(Boolean).join(" · ");
  const sold = c.inventory_status === "sold" ? (locale === "uz" ? " · ❌ sotilgan" : locale === "en" ? " · ❌ sold" : " · ❌ продан")
    : c.inventory_status === "reserved" ? (locale === "uz" ? " · 🔒 band" : locale === "en" ? " · 🔒 reserved" : " · 🔒 бронь") : "";
  const lines = [
    `🚗 <b>${escapeHtml(`${c.brand} ${c.model} ${c.year}`)}</b>${sold}`,
    `💰 $${Number(c.price_usd).toLocaleString("en-US")}`,
    [BODY[locale][c.body_type] || c.body_type, FUEL[locale][c.fuel_type] || c.fuel_type, c.drivetrain ? c.drivetrain.toUpperCase() : ""].filter(Boolean).join(" · "),
    chips,
    c.color ? `🎨 ${escapeHtml(c.color)}` : "",
  ].filter(Boolean);
  return lines.join("\n").slice(0, 1000);
}

async function handleCarDetailCallback(cb: TgCallbackQuery): Promise<void> {
  const chatId = cb.message?.chat?.id;
  const carId = (cb.data || "").slice(4);
  await tgAnswerCallback(cb.id);
  if (!chatId || !/^[a-f0-9-]{8,64}$/i.test(carId)) return;
  const locale = botLocale(cb.from?.language_code);
  const supabase = createServiceClient();
  const { data: c } = await supabase
    .from("cars")
    .select("id, slug, brand, model, year, price_usd, price_uzs, body_type, fuel_type, engine_power, range_km, seats, drivetrain, mileage, color, images, inventory_status")
    .eq("id", carId)
    .maybeSingle();
  if (!c) return;
  const car = c as CarCardRow;
  trackBot(chatId, "car_view", { carId });
  const reserveLbl = locale === "uz" ? "Band qilish" : locale === "en" ? "Reserve" : "Забронировать";
  const siteLbl = locale === "uz" ? "Saytda ochish" : locale === "en" ? "Open on site" : "Открыть на сайте";
  const kb: ReplyMarkup = { inline_keyboard: [
    [{ text: `📝 ${reserveLbl}`, callback_data: `rsv:${car.id}` }, { text: "🔔", callback_data: `pw:${car.id}` }],
    [{ text: `🌐 ${siteLbl}`, url: `${siteUrl()}/${locale}/catalog/${car.slug}?utm_source=telegram` }],
  ] };
  const caption = carCaption(car, locale);
  const img = Array.isArray(car.images) ? car.images[0] : null;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (img && token) {
    await fetch(`${TG_API}/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, photo: img, caption, parse_mode: "HTML", reply_markup: kb }),
    }).catch(() => {});
  } else {
    await tgSend(chatId, caption, kb);
  }
}

// ---- Client voice-note search: transcribe (Whisper) → recommend ------------
async function handleClientVoice(chatId: number, file: TgFile, locale: BotLocale, from: TgUser): Promise<void> {
  const t = {
    unavailable: locale === "uz" ? "🎙 Ovozli qidiruv hozircha mavjud emas — nimani qidirayotganingizni yozing." : locale === "en" ? "🎙 Voice search isn't available right now — please type what you're looking for." : "🎙 Голосовой поиск пока недоступен — напишите текстом, что ищете.",
    big: locale === "uz" ? "Ovozli xabar juda uzun. Qisqaroq yuboring yoki yozing." : locale === "en" ? "That voice note is too long. Send a shorter one or type." : "Голосовое слишком длинное. Отправьте короче или напишите текстом.",
    working: locale === "uz" ? "🎙 Ovozli xabarni tahlil qilyapman…" : locale === "en" ? "🎙 Transcribing your voice note…" : "🎙 Распознаю голосовое сообщение…",
    failed: locale === "uz" ? "Ovozni aniqlay olmadim. Iltimos, yozib yuboring." : locale === "en" ? "Couldn't recognize the audio. Please type instead." : "Не удалось распознать. Напишите, пожалуйста, текстом.",
  };
  if (!process.env.WHISPER_URL) { await tgSend(chatId, t.unavailable); return; }
  if (!llmAllowed(chatId)) { await tgSend(chatId, throttledMsg(locale)); return; }
  if (file.file_size && file.file_size > 20 * 1024 * 1024) { await tgSend(chatId, t.big); return; }
  await tgSend(chatId, t.working);
  const bytes = await tgDownloadFile(file.file_id);
  if (!bytes || bytes.byteLength === 0) { await tgSend(chatId, t.failed); return; }
  const { text } = await transcribeAudio(bytes, { filename: file.file_name || "voice.ogg" });
  const q = (text || "").trim().slice(0, 500);
  if (!q) { await tgSend(chatId, t.failed); return; }
  const replyLocale = resolveReplyLocale(q, locale);
  await tgSend(chatId, `🎙 «${escapeHtml(q.slice(0, 200))}»`);
  const supabase = createServiceClient();
  const { reply, cars } = await runAssistantTurn(supabase, {
    channel: "telegram", externalKey: chatId, message: q, locale: replyLocale, knownName: from.first_name || null,
  });
  trackBot(chatId, "recommend", { count: cars.length, src: "voice" });
  await tgSend(chatId, escapeHtml(reply), carButtons(cars, replyLocale) ?? contactKeyboard(replyLocale));
  await tgSendCarPhotos(chatId, cars);
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

// ---- Service flows: trade-in / test-drive / installments / service ---------
const SERVICE_MARKER = "[svc:";
const SERVICES: Record<string, { type: string; label: Record<BotLocale, string>; prompt: Record<BotLocale, string> }> = {
  trade_in: {
    type: "trade_in",
    label: { ru: "🔄 Trade-in (обмен)", uz: "🔄 Trade-in", en: "🔄 Trade-in" },
    prompt: {
      ru: "🔄 Trade-in. Опишите ваш авто (марка, год, пробег) и укажите номер телефона — оценим обмен:",
      uz: "🔄 Trade-in. Avtongizni yozing (marka, yil, probeg) va telefon raqamingizni qoldiring — almashuvni baholaymiz:",
      en: "🔄 Trade-in. Describe your car (make, year, mileage) and leave your phone — we'll value the trade:",
    },
  },
  test_drive: {
    type: "test_drive",
    label: { ru: "🚗 Тест-драйв", uz: "🚗 Test-drayv", en: "🚗 Test drive" },
    prompt: {
      ru: "🚗 Тест-драйв. Какой авто хотите попробовать? Укажите номер телефона — организуем:",
      uz: "🚗 Test-drayv. Qaysi avtoni sinab ko'rmoqchisiz? Telefon raqamingizni qoldiring:",
      en: "🚗 Test drive. Which car would you like to try? Leave your phone — we'll arrange it:",
    },
  },
  installment: {
    type: "callback",
    label: { ru: "💳 Рассрочка", uz: "💳 Bo'lib to'lash", en: "💳 Installments" },
    prompt: {
      ru: "💳 Рассрочка. Укажите интересующий авто и номер телефона — менеджер рассчитает условия:",
      uz: "💳 Bo'lib to'lash. Qaysi avto qiziqtirayotganini va telefon raqamingizni yozing:",
      en: "💳 Installments. Tell us the car and leave your phone — a manager will work out the terms:",
    },
  },
  service: {
    type: "service",
    label: { ru: "🛠 Сервис", uz: "🛠 Servis", en: "🛠 Service" },
    prompt: {
      ru: "🛠 Сервис. Опишите услугу или проблему и укажите номер телефона:",
      uz: "🛠 Servis. Xizmat yoki muammoni yozing va telefon raqamingizni qoldiring:",
      en: "🛠 Service. Describe the service/issue and leave your phone:",
    },
  },
};

function servicesMenu(locale: BotLocale): { text: string; markup: ReplyMarkup } {
  const title = locale === "uz" ? "🛠 <b>Xizmatlar</b> — kerakli bo'limni tanlang:" : locale === "en" ? "🛠 <b>Services</b> — choose one:" : "🛠 <b>Услуги</b> — выберите нужное:";
  const back = locale === "uz" ? "🔙 Menyu" : locale === "en" ? "🔙 Menu" : "🔙 Меню";
  const rows = ["trade_in", "test_drive", "installment", "service"].map((k) => [{ text: SERVICES[k].label[locale], callback_data: `svc|${k}` }]);
  rows.push([{ text: back, callback_data: "m|menu" }]);
  return { text: title, markup: { inline_keyboard: rows } };
}

/** Pull the first plausible phone (9–15 digits) out of free text. */
function extractPhone(s: string): string | null {
  const m = s.replace(/[()\-]/g, " ").match(/\+?\d[\d\s]{7,16}\d/);
  if (!m) return null;
  const digits = m[0].replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15 ? digits : null;
}

async function handleServiceCallback(cb: TgCallbackQuery): Promise<void> {
  const chatId = cb.message?.chat?.id;
  await tgAnswerCallback(cb.id);
  if (!chatId) return;
  const locale = botLocale(cb.from?.language_code);
  const key = (cb.data || "").slice(4);
  const svc = SERVICES[key];
  if (!svc) return;
  await tgSend(chatId, `${SERVICE_MARKER}${key}]\n${svc.prompt[locale]}`, { force_reply: true, input_field_placeholder: "…" });
}

async function captureServiceLead(chatId: number, locale: BotLocale, promptText: string, text: string, from: TgUser): Promise<void> {
  const m = promptText.match(/\[svc:([a-z_]+)\]/);
  if (!m) return;
  const key = m[1];
  const svc = SERVICES[key];
  if (!svc) return;
  let phone = extractPhone(text);
  if (!phone) {
    const { data: c } = await createServiceClient().from("customers").select("phone").eq("telegram_id", chatId).maybeSingle();
    if (c?.phone) phone = String(c.phone);
  }
  if (!phone) {
    const ask = locale === "uz" ? "Iltimos, xabarga telefon raqamingizni ham qo'shing:" : locale === "en" ? "Please include your phone number in the message:" : "Пожалуйста, добавьте номер телефона в сообщение:";
    await tgSend(chatId, `${SERVICE_MARKER}${key}]\n${ask}`, { force_reply: true });
    return;
  }
  await captureLead(chatId, locale, { name: from.first_name || "Telegram", phone }, { type: svc.type, message: `[${key}] ${text}`.slice(0, 500) });
}

// Refine the last recommendation in place — the phrase rides the same assistant
// thread (channel:chatId), so recommendCars refines against the prior context.
const REFINE: Record<BotLocale, Record<string, string>> = {
  ru: { cheaper: "покажи дешевле", pricier: "покажи дороже, премиальнее", bigger: "просторнее, больше места и багажник" },
  uz: { cheaper: "arzonrog'ini ko'rsat", pricier: "qimmatroq, premiumroq", bigger: "kengroq, ko'proq joy va bagaj" },
  en: { cheaper: "show cheaper ones", pricier: "show more premium ones", bigger: "more spacious, bigger boot" },
};

async function handleRefineCallback(cb: TgCallbackQuery): Promise<void> {
  const chatId = cb.message?.chat?.id;
  await tgAnswerCallback(cb.id);
  if (!chatId) return;
  const locale = botLocale(cb.from?.language_code);
  const phrase = REFINE[locale][(cb.data || "").slice(4)];
  if (!phrase) return;
  if (!llmAllowed(chatId)) { await tgSend(chatId, throttledMsg(locale)); return; }
  const supabase = createServiceClient();
  const { reply, cars } = await runAssistantTurn(supabase, {
    channel: "telegram", externalKey: chatId, message: phrase, locale, knownName: cb.from?.first_name || null,
  });
  await tgSend(chatId, escapeHtml(reply), carButtons(cars, locale) ?? contactKeyboard(locale));
  await tgSendCarPhotos(chatId, cars);
}

// Save the customer's last query as a saved search → the saved-search-alerts
// cron then DMs them (Telegram-first via sendToCustomer) when a new car matches.
async function handleSaveSearchCallback(cb: TgCallbackQuery): Promise<void> {
  const chatId = cb.message?.chat?.id;
  await tgAnswerCallback(cb.id);
  if (!chatId) return;
  const locale = botLocale(cb.from?.language_code);
  const supabase = createServiceClient();
  const { data: customer } = await supabase.from("customers").select("id").eq("telegram_id", chatId).maybeSingle();
  if (!customer?.id) {
    const ask = locale === "uz" ? "Yangi avtolar haqida xabar olish uchun avval raqamingizni ulashing 👇" : locale === "en" ? "To get alerts on new matches, share your number first 👇" : "Чтобы получать уведомления о новых авто, поделитесь номером 👇";
    await tgSend(chatId, ask, contactKeyboard(locale));
    return;
  }
  const { data: last } = await supabase
    .from("assistant_messages")
    .select("content")
    .eq("thread_id", `telegram:${chatId}`)
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const query = String(last?.content || "").trim().slice(0, 120);
  if (!query) {
    await tgSend(chatId, locale === "uz" ? "Avval nimani qidirayotganingizni yozing." : locale === "en" ? "First tell me what you're looking for." : "Сначала опишите, что вы ищете.");
    return;
  }
  const { data: dupe } = await supabase.from("saved_searches").select("id").eq("customer_id", customer.id).eq("label", query).maybeSingle();
  if (dupe) {
    await tgSend(chatId, locale === "uz" ? "🔔 Bu qidiruv allaqachon saqlangan." : locale === "en" ? "🔔 This search is already saved." : "🔔 Этот поиск уже сохранён.");
    return;
  }
  await supabase.from("saved_searches").insert({ customer_id: customer.id, label: query, filters: { search: query } });
  await tgSend(chatId, locale === "uz" ? `🔔 Saqlandi: «${escapeHtml(query)}». Mos avto kelsa, Telegramda xabar beramiz.` : locale === "en" ? `🔔 Saved: “${escapeHtml(query)}”. We'll DM you on Telegram when a match arrives.` : `🔔 Сохранил: «${escapeHtml(query)}». Уведомлю в Telegram, как только появится подходящее авто.`);
}

async function handleFindCallback(cb: TgCallbackQuery): Promise<void> {
  const chatId = cb.message?.chat?.id;
  await tgAnswerCallback(cb.id);
  if (!chatId) return;
  const locale = botLocale(cb.from?.language_code);
  const query = FIND_QUERY[locale][(cb.data || "").slice(5)];
  if (!query) return;
  if (!llmAllowed(chatId)) { await tgSend(chatId, throttledMsg(locale)); return; }
  const supabase = createServiceClient();
  const { reply, cars } = await runAssistantTurn(supabase, {
    channel: "telegram", externalKey: chatId, message: query, locale, knownName: cb.from?.first_name || null,
  });
  trackBot(chatId, "recommend", { count: cars.length, src: "find" });
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
    case "svc": {
      const sm = servicesMenu(locale);
      await tgSend(chatId, sm.text, sm.markup);
      return;
    }
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
    else if (data.startsWith("car:")) await handleCarDetailCallback(cb);
    else if (data.startsWith("find|")) await handleFindCallback(cb);
    else if (data.startsWith("ref|")) await handleRefineCallback(cb);
    else if (data.startsWith("ss|")) await handleSaveSearchCallback(cb);
    else if (data.startsWith("svc|")) await handleServiceCallback(cb);
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
    if (message.reply_to_message?.text?.includes(CRM_REPLY_MARKER)) {
      await handleCrmReply(createServiceClient(), chatId, message.reply_to_message.text, opText);
      return;
    }
    if (message.reply_to_message?.text?.includes(CRM_NOTE_MARKER)) {
      await handleCrmNote(createServiceClient(), chatId, message.reply_to_message.text, opText);
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

  // 1.1) Client voice note → transcribe (Whisper) → recommend. (Operator voice
  //      is the call-recording path handled in the operator branch above.)
  if (message.voice || message.audio) {
    await handleClientVoice(chatId, (message.voice || message.audio)!, locale, from);
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

  // 1.6) Service flow — a reply to a service prompt carries [svc:<key>].
  if (message.reply_to_message?.text?.includes(SERVICE_MARKER)) {
    await captureServiceLead(chatId, locale, message.reply_to_message.text, text, from);
    return;
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
        trackBot(chatId, "start");
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
  if (!llmAllowed(chatId)) { await tgSend(chatId, throttledMsg(locale)); return; }
  const replyLocale = resolveReplyLocale(text, locale);
  const supabase = createServiceClient();
  const { reply, cars } = await runAssistantTurn(supabase, {
    channel: "telegram",
    externalKey: chatId,
    message: text,
    locale: replyLocale,
    knownName: from.first_name || null,
  });
  trackBot(chatId, "recommend", { count: cars.length, src: "text" });
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
