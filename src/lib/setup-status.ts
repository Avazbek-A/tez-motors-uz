/**
 * Setup / integrations status — makes the fail-open architecture legible to a
 * non-technical owner. Every external capability is gated on an env var and
 * degrades gracefully when unset; this module describes each capability, what
 * enabling it unlocks, and which env vars switch it on. The route fills in a
 * presence map (booleans only — never secret values); this pure module turns
 * that into a grouped, prioritized status the admin page renders. Unit-tested.
 */
import type { Locale } from "@/i18n/config";

export type IntegrationCategory = "core" | "ai" | "messaging" | "payments" | "marketing" | "security";

export interface IntegrationDef {
  key: string;
  label: string;
  /** What turning this on adds for the business. */
  unlocks: string;
  /** Env vars that must ALL be present for the capability to be active. */
  envVars: string[];
  category: IntegrationCategory;
  /** Core = the platform can't run without it; others are optional upgrades. */
  required?: boolean;
}

export const INTEGRATIONS: IntegrationDef[] = [
  // Core — must be set for the site to run.
  { key: "supabase", label: "Database (Supabase)", unlocks: "The whole platform — inventory, leads, orders, money.", envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"], category: "core", required: true },
  { key: "admin", label: "Admin login", unlocks: "Access to this admin panel.", envVars: ["ADMIN_PASSWORD"], category: "core", required: true },

  // AI.
  { key: "llm", label: "AI brain (LLM)", unlocks: "Natural-language briefings, AI sales/marketing copy & replies. Use a hosted key (LLM_API_KEY) or a FREE local Ollama (LLM_PROVIDER=openai + LLM_API_URL).", envVars: ["LLM_API_KEY"], category: "ai" },
  { key: "ai_autorespond", label: "AI auto-respond", unlocks: "Bots reply to customers automatically (otherwise they wait for you).", envVars: ["AI_AUTORESPOND"], category: "ai" },

  // Messaging / notifications.
  { key: "telegram_alerts", label: "Telegram lead alerts", unlocks: "Instant new-lead and order alerts to your phone.", envVars: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"], category: "messaging" },
  { key: "telegram_channel", label: "Telegram channel posting", unlocks: "Auto-post marketing content to your public channel.", envVars: ["TELEGRAM_CHANNEL_ID"], category: "messaging" },
  { key: "telegram_bot", label: "Telegram inbound bot", unlocks: "Customers browse inventory and get recommendations in Telegram.", envVars: ["TELEGRAM_WEBHOOK_SECRET"], category: "messaging" },
  { key: "whatsapp", label: "WhatsApp bot", unlocks: "Customers reach you on WhatsApp with the same AI assistant.", envVars: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "WHATSAPP_VERIFY_TOKEN"], category: "messaging" },
  { key: "email", label: "Email (Resend)", unlocks: "Customer confirmations, price-drop alerts, and your daily digest by email.", envVars: ["RESEND_API_KEY", "EMAIL_FROM"], category: "messaging" },
  { key: "sms", label: "SMS (Eskiz)", unlocks: "Phone-number login (OTP) and SMS alerts for customers.", envVars: ["ESKIZ_EMAIL", "ESKIZ_PASSWORD"], category: "messaging" },
  { key: "push", label: "Web push", unlocks: "Browser push notifications to bring customers back.", envVars: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"], category: "messaging" },

  // Payments.
  { key: "payme", label: "Payme deposits", unlocks: "Take refundable reservation deposits online via Payme.", envVars: ["PAYME_MERCHANT_ID", "PAYME_MERCHANT_KEY"], category: "payments" },
  { key: "click", label: "Click deposits", unlocks: "Take online deposits via Click — a second payment rail.", envVars: ["CLICK_SERVICE_ID", "CLICK_SECRET_KEY", "CLICK_MERCHANT_ID"], category: "payments" },

  // Security / ops.
  { key: "turnstile", label: "Bot protection (Turnstile)", unlocks: "Cloudflare Turnstile on public forms to block spam.", envVars: ["TURNSTILE_SECRET"], category: "security" },
  { key: "cron", label: "Scheduled jobs", unlocks: "Daily briefings, follow-ups, auto-posting, price sweeps — the autopilot.", envVars: ["CRON_SECRET"], category: "security" },
];

export interface IntegrationStatus extends IntegrationDef {
  active: boolean;
  /** Env vars still missing for this capability (empty when active). */
  missing: string[];
}

export interface SetupSummary {
  integrations: IntegrationStatus[];
  totalOptional: number;
  activeOptional: number;
  coreReady: boolean;
}

/**
 * Turn a presence map (envVar -> isSet) into a grouped, computed status.
 * `overrides` forces an integration's `active` regardless of its env vars — used
 * for capabilities with multi-var logic (e.g. LLM: a key OR an Ollama URL).
 */
export function buildSetupStatus(present: Record<string, boolean>, overrides: Record<string, boolean> = {}): SetupSummary {
  const integrations: IntegrationStatus[] = INTEGRATIONS.map((def) => {
    const missing = def.envVars.filter((v) => !present[v]);
    const active = def.key in overrides ? !!overrides[def.key] : missing.length === 0;
    return { ...def, active, missing: active ? [] : missing };
  });
  const optional = integrations.filter((i) => !i.required);
  return {
    integrations,
    totalOptional: optional.length,
    activeOptional: optional.filter((i) => i.active).length,
    coreReady: integrations.filter((i) => i.required).every((i) => i.active),
  };
}

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  core: "Core",
  ai: "AI",
  messaging: "Messaging & notifications",
  payments: "Payments",
  marketing: "Marketing",
  security: "Security & automation",
};

/**
 * Trilingual UI text for each integration item, keyed by `IntegrationDef.key`.
 * The English (`en`) strings match the existing `label`/`unlocks` fields above
 * verbatim. Env-var names inside sentences are kept literal across all locales.
 */
export const SETUP_ITEM_I18N: Record<string, Record<Locale, { label: string; unlocks: string }>> = {
  supabase: {
    ru: { label: "База данных (Supabase)", unlocks: "Вся платформа — склад, заявки, заказы, деньги." },
    uz: { label: "Ma'lumotlar bazasi (Supabase)", unlocks: "Butun platforma — ombor, so'rovlar, buyurtmalar, pul." },
    en: { label: "Database (Supabase)", unlocks: "The whole platform — inventory, leads, orders, money." },
  },
  admin: {
    ru: { label: "Вход администратора", unlocks: "Доступ к этой панели администратора." },
    uz: { label: "Administrator kirishi", unlocks: "Ushbu administrator paneliga kirish." },
    en: { label: "Admin login", unlocks: "Access to this admin panel." },
  },
  llm: {
    ru: { label: "ИИ-мозг (LLM)", unlocks: "Брифинги на естественном языке, ИИ-тексты для продаж/маркетинга и ответы. Используйте облачный ключ (LLM_API_KEY) или БЕСПЛАТНЫЙ локальный Ollama (LLM_PROVIDER=openai + LLM_API_URL)." },
    uz: { label: "AI miya (LLM)", unlocks: "Tabiiy tilda brifinglar, sotuv/marketing uchun AI matnlar va javoblar. Bulutli kalit (LLM_API_KEY) yoki BEPUL mahalliy Ollama (LLM_PROVIDER=openai + LLM_API_URL) ishlating." },
    en: { label: "AI brain (LLM)", unlocks: "Natural-language briefings, AI sales/marketing copy & replies. Use a hosted key (LLM_API_KEY) or a FREE local Ollama (LLM_PROVIDER=openai + LLM_API_URL)." },
  },
  ai_autorespond: {
    ru: { label: "ИИ-автоответ", unlocks: "Боты отвечают клиентам автоматически (иначе они ждут вас)." },
    uz: { label: "AI avto-javob", unlocks: "Botlar mijozlarga avtomatik javob beradi (aks holda ular sizni kutadi)." },
    en: { label: "AI auto-respond", unlocks: "Bots reply to customers automatically (otherwise they wait for you)." },
  },
  telegram_alerts: {
    ru: { label: "Telegram-уведомления о заявках", unlocks: "Мгновенные уведомления о новых заявках и заказах на ваш телефон." },
    uz: { label: "Telegram so'rov bildirishnomalari", unlocks: "Yangi so'rov va buyurtmalar haqida telefoningizga zudlik bilan bildirishnomalar." },
    en: { label: "Telegram lead alerts", unlocks: "Instant new-lead and order alerts to your phone." },
  },
  telegram_channel: {
    ru: { label: "Публикация в Telegram-канал", unlocks: "Авто-публикация маркетингового контента в ваш публичный канал." },
    uz: { label: "Telegram kanalga joylash", unlocks: "Marketing kontentini ommaviy kanalingizga avtomatik joylash." },
    en: { label: "Telegram channel posting", unlocks: "Auto-post marketing content to your public channel." },
  },
  telegram_bot: {
    ru: { label: "Входящий Telegram-бот", unlocks: "Клиенты просматривают склад и получают рекомендации в Telegram." },
    uz: { label: "Kiruvchi Telegram bot", unlocks: "Mijozlar Telegramda omborni ko'radi va tavsiyalar oladi." },
    en: { label: "Telegram inbound bot", unlocks: "Customers browse inventory and get recommendations in Telegram." },
  },
  whatsapp: {
    ru: { label: "WhatsApp-бот", unlocks: "Клиенты связываются с вами в WhatsApp с тем же ИИ-ассистентом." },
    uz: { label: "WhatsApp bot", unlocks: "Mijozlar siz bilan WhatsAppda xuddi shu AI yordamchi orqali bog'lanadi." },
    en: { label: "WhatsApp bot", unlocks: "Customers reach you on WhatsApp with the same AI assistant." },
  },
  email: {
    ru: { label: "Email (Resend)", unlocks: "Подтверждения для клиентов, уведомления о снижении цен и ваш ежедневный дайджест по email." },
    uz: { label: "Email (Resend)", unlocks: "Mijozlar uchun tasdiqlar, narx tushishi haqida bildirishnomalar va kunlik dayjestingiz email orqali." },
    en: { label: "Email (Resend)", unlocks: "Customer confirmations, price-drop alerts, and your daily digest by email." },
  },
  sms: {
    ru: { label: "SMS (Eskiz)", unlocks: "Вход по номеру телефона (OTP) и SMS-уведомления для клиентов." },
    uz: { label: "SMS (Eskiz)", unlocks: "Telefon raqami orqali kirish (OTP) va mijozlar uchun SMS bildirishnomalar." },
    en: { label: "SMS (Eskiz)", unlocks: "Phone-number login (OTP) and SMS alerts for customers." },
  },
  push: {
    ru: { label: "Веб-push", unlocks: "Push-уведомления в браузере, чтобы вернуть клиентов." },
    uz: { label: "Veb-push", unlocks: "Mijozlarni qaytarish uchun brauzerdagi push-bildirishnomalar." },
    en: { label: "Web push", unlocks: "Browser push notifications to bring customers back." },
  },
  payme: {
    ru: { label: "Депозиты Payme", unlocks: "Принимайте возвратные депозиты за бронь онлайн через Payme." },
    uz: { label: "Payme depozitlari", unlocks: "Qaytariladigan bron depozitlarini onlayn Payme orqali qabul qiling." },
    en: { label: "Payme deposits", unlocks: "Take refundable reservation deposits online via Payme." },
  },
  click: {
    ru: { label: "Депозиты Click", unlocks: "Принимайте онлайн-депозиты через Click — второй платёжный канал." },
    uz: { label: "Click depozitlari", unlocks: "Onlayn depozitlarni Click orqali qabul qiling — ikkinchi to'lov kanali." },
    en: { label: "Click deposits", unlocks: "Take online deposits via Click — a second payment rail." },
  },
  turnstile: {
    ru: { label: "Защита от ботов (Turnstile)", unlocks: "Cloudflare Turnstile на публичных формах для блокировки спама." },
    uz: { label: "Botlardan himoya (Turnstile)", unlocks: "Spamni bloklash uchun ommaviy formalarda Cloudflare Turnstile." },
    en: { label: "Bot protection (Turnstile)", unlocks: "Cloudflare Turnstile on public forms to block spam." },
  },
  cron: {
    ru: { label: "Запланированные задачи", unlocks: "Ежедневные брифинги, дожимы, авто-постинг, проверка цен — автопилот." },
    uz: { label: "Rejalashtirilgan vazifalar", unlocks: "Kunlik brifinglar, qayta murojaatlar, avto-joylash, narx tekshiruvlari — avtopilot." },
    en: { label: "Scheduled jobs", unlocks: "Daily briefings, follow-ups, auto-posting, price sweeps — the autopilot." },
  },
};

/** Trilingual category headings, keyed by `IntegrationCategory`. */
export const CATEGORY_LABELS_I18N: Record<string, Record<Locale, string>> = {
  core: { ru: "Ядро", uz: "Yadro", en: "Core" },
  ai: { ru: "ИИ", uz: "AI", en: "AI" },
  messaging: { ru: "Сообщения и уведомления", uz: "Xabarlar va bildirishnomalar", en: "Messaging & notifications" },
  payments: { ru: "Платежи", uz: "To'lovlar", en: "Payments" },
  marketing: { ru: "Маркетинг", uz: "Marketing", en: "Marketing" },
  security: { ru: "Безопасность и автоматизация", uz: "Xavfsizlik va avtomatlashtirish", en: "Security & automation" },
};

/** Localized label + unlocks for an integration item; falls back to English. */
export function setupItemText(key: string, locale: Locale): { label: string; unlocks: string } {
  const entry = SETUP_ITEM_I18N[key]?.[locale];
  if (entry) return entry;
  const def = INTEGRATIONS.find((i) => i.key === key);
  return { label: def?.label ?? key, unlocks: def?.unlocks ?? "" };
}

/** Localized category heading; falls back to the existing English label. */
export function categoryLabel(key: string, locale: Locale): string {
  return CATEGORY_LABELS_I18N[key]?.[locale] ?? CATEGORY_LABELS[key as IntegrationCategory] ?? key;
}
