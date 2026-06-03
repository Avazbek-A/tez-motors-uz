/**
 * Setup / integrations status — makes the fail-open architecture legible to a
 * non-technical owner. Every external capability is gated on an env var and
 * degrades gracefully when unset; this module describes each capability, what
 * enabling it unlocks, and which env vars switch it on. The route fills in a
 * presence map (booleans only — never secret values); this pure module turns
 * that into a grouped, prioritized status the admin page renders. Unit-tested.
 */
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
  { key: "llm", label: "AI brain (LLM)", unlocks: "Natural-language morning briefings, AI sales replies, and marketing copy — instead of templates.", envVars: ["LLM_API_KEY"], category: "ai" },
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

/** Turn a presence map (envVar -> isSet) into a grouped, computed status. */
export function buildSetupStatus(present: Record<string, boolean>): SetupSummary {
  const integrations: IntegrationStatus[] = INTEGRATIONS.map((def) => {
    const missing = def.envVars.filter((v) => !present[v]);
    return { ...def, active: missing.length === 0, missing };
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
