/**
 * Inbound WhatsApp bot webhook (Meta Cloud API).
 *
 * Mirrors the Telegram bot: free text is answered by the SAME grounded
 * recommender the web "Find my car" widget uses (src/lib/assistant-core →
 * recommendCars), so the bot never invents cars or prices — every suggestion is
 * a real, in-stock row with a deep link to the site. WhatsApp inherently carries
 * the sender's number, so an explicit "call me" intent (or a typed number)
 * creates a qualified lead and notifies the dealer.
 *
 * Reuses the inquiry type `car_inquiry` (source_page="whatsapp-bot",
 * metadata.channel="whatsapp") to avoid a CHECK-constraint migration.
 *
 * Security:
 *   GET  — Meta's webhook verification handshake; echoes hub.challenge only when
 *          hub.verify_token matches WHATSAPP_VERIFY_TOKEN.
 *   POST — message events. Fail-open: when WHATSAPP_TOKEN / WHATSAPP_PHONE_ID are
 *          unset the webhook accepts and ignores so Meta doesn't retry-storm.
 *
 * Workers-safe (single fetch to the Graph API), no node-only deps.
 *
 * One-time setup (after deploy): in the Meta app dashboard set the callback URL to
 * https://tezmotors.uz/api/bot/whatsapp and the verify token to WHATSAPP_VERIFY_TOKEN,
 * then subscribe the WhatsApp Business Account to the `messages` field.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyNewInquiry } from "@/lib/notify";
import { runAssistantTurn, markConversationHandoff } from "@/lib/assistant-runtime";
import { normalizePhone } from "@/lib/customer-auth";
import { logEvent } from "@/lib/error-report";
import { verifyHmacSha256 } from "@/lib/hmac";
import type { Car } from "@/types/car";

const GRAPH_API = "https://graph.facebook.com/v21.0";

type BotLocale = "ru" | "uz" | "en";

interface WaMessage {
  from?: string;
  type?: string;
  text?: { body?: string };
}
interface WaContact {
  profile?: { name?: string };
  wa_id?: string;
}
interface WaChangeValue {
  messages?: WaMessage[];
  contacts?: WaContact[];
}
interface WaUpdate {
  entry?: { changes?: { value?: WaChangeValue }[] }[];
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://tezmotors.uz").replace(/\/$/, "");
}

// WhatsApp gives no per-user language; default to RU (the dealer's primary market).
const DEFAULT_LOCALE: BotLocale = "ru";

// A message is treated as a phone only if, once formatting is stripped, it is
// purely 9–15 digits — so a budget like "до 25000000" (has letters) stays a query.
function looksLikePhone(s: string): boolean {
  const cleaned = s.replace(/[\s+\-()]/g, "");
  return /^\d{9,15}$/.test(cleaned);
}

// Explicit "have a manager call me" intent across the three languages.
const CONTACT_INTENT =
  /\b(call|manager|contact|свяж|звон|позвон|контакт|менеджер|menejer|raqam|qo'ng'iroq|bog'lan)\b/i;

async function waSend(to: string, body: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return;
  try {
    await fetch(`${GRAPH_API}/${phoneId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: body.slice(0, 4000), preview_url: false },
      }),
    });
  } catch {
    // fail-open
  }
}

/**
 * Send the recommended cars as images with captions (visual cards convert far
 * better than a text list). Up to 3, one message each. Additive to the text
 * reply; fail-open and silent when cars have no images.
 */
async function waSendCarImages(to: string, cars: Car[], locale: BotLocale): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return;
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://tezmotors.uz").replace(/\/$/, "");
  const items = cars
    .slice(0, 3)
    .map((c) => ({ c, img: Array.isArray(c.images) ? c.images[0] : undefined }))
    .filter((x): x is { c: Car; img: string } => typeof x.img === "string" && x.img.length > 0);
  for (const { c, img } of items) {
    const caption = `${c.brand} ${c.model} ${c.year} — $${c.price_usd.toLocaleString("en-US")}\n${base}/${locale}/catalog/${c.slug}`;
    try {
      await fetch(`${GRAPH_API}/${phoneId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "image",
          image: { link: img, caption: caption.slice(0, 1024) },
        }),
      });
    } catch {
      // fail-open
    }
  }
}

// ---- Localized copy --------------------------------------------------------

const COPY: Record<BotLocale, { nudge: string; thanks: string }> = {
  ru: {
    nudge: "Чтобы менеджер связался и рассказал про рассрочку — напишите «менеджер» или оставьте номер телефона.",
    thanks: "Спасибо! Менеджер свяжется с вами в ближайшее время. 📞",
  },
  uz: {
    nudge: "Menejer bog'lanib bo'lib to'lash haqida aytib berishi uchun «menejer» deb yozing yoki raqamingizni qoldiring.",
    thanks: "Rahmat! Menejer tez orada siz bilan bog'lanadi. 📞",
  },
  en: {
    nudge: "To have a manager reach out and explain installments — reply \"manager\" or leave your phone number.",
    thanks: "Thank you! A manager will contact you shortly. 📞",
  },
};

// WhatsApp has no inline buttons in the basic text API, so the deep links live in
// the message body (WhatsApp auto-links URLs).
function carLines(cars: Car[], locale: BotLocale): string {
  return cars
    .slice(0, 3)
    .map(
      (c) =>
        `• ${c.brand} ${c.model} ${c.year} — $${c.price_usd.toLocaleString("en-US")}\n${siteUrl()}/${locale}/catalog/${c.slug}`,
    )
    .join("\n\n");
}

// ---- Lead capture ----------------------------------------------------------

async function captureLead(lead: { name: string; phone: string; waId: string }, locale: BotLocale): Promise<void> {
  const supabase = createServiceClient();
  const phone = normalizePhone(lead.phone) || lead.phone;
  const name = lead.name?.trim() || "WhatsApp";

  let inquiryId: string | null = null;
  try {
    const { data } = await supabase
      .from("inquiries")
      .insert({
        name,
        phone,
        type: "car_inquiry",
        message: "WhatsApp bot lead",
        source_page: "whatsapp-bot",
        metadata: { channel: "whatsapp" },
        status: "new",
      })
      .select("id")
      .single();
    inquiryId = (data?.id as string) || null;
  } catch {
    /* fail-open */
  }

  // Mark the AI conversation as handed off so the dealer sees the hot lead.
  markConversationHandoff(supabase, "whatsapp", lead.waId, { name, phone, inquiryId }).catch(() => {});

  notifyNewInquiry({
    name,
    phone,
    type: "car_inquiry",
    message: "WhatsApp bot lead",
    source_page: "whatsapp-bot",
    metadata: { channel: "whatsapp" },
    locale,
  }).catch(() => {});
}

// ---- Update handling -------------------------------------------------------

async function handleUpdate(update: WaUpdate): Promise<void> {
  const change = update.entry?.[0]?.changes?.[0]?.value;
  const message = change?.messages?.[0];
  if (!message || message.type !== "text" || !message.from) return;

  const from = message.from; // sender's wa_id (their phone, digits only)
  const profileName = change?.contacts?.[0]?.profile?.name || "WhatsApp";
  const text = (message.text?.body || "").trim();
  const locale = DEFAULT_LOCALE;
  if (!text) return;

  // 1) Typed phone → lead with that number.
  if (looksLikePhone(text)) {
    const normalized = normalizePhone(text);
    if (normalized) {
      await captureLead({ name: profileName, phone: normalized, waId: from }, locale);
      await waSend(from, COPY[locale].thanks);
      return;
    }
  }

  // 2) Explicit "call me" intent → lead using the WhatsApp sender number.
  if (CONTACT_INTENT.test(text)) {
    await captureLead({ name: profileName, phone: from, waId: from }, locale);
    await waSend(from, COPY[locale].thanks);
    return;
  }

  // 3) Free text → grounded recommendation + qualification (shared closer
  //    runtime: multi-turn memory, profile, nudges, dealer oversight).
  const supabase = createServiceClient();
  const { reply, cars } = await runAssistantTurn(supabase, {
    channel: "whatsapp",
    externalKey: from,
    message: text,
    locale,
    knownName: profileName,
  });
  const lines = carLines(cars, locale);
  const body = [reply, lines].filter(Boolean).join("\n\n");
  await waSend(from, body);
  await waSendCarImages(from, cars, locale);
}

// ---- Webhook verification (GET) -------------------------------------------

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && expected && token === expected && challenge) {
    // Meta expects the raw challenge echoed back as text/plain.
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ---- Message events (POST) -------------------------------------------------

export async function POST(request: NextRequest) {
  // Fail-open: not configured → accept and ignore so Meta doesn't retry-storm.
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_ID) {
    return NextResponse.json({ ok: true });
  }

  // Read the raw body so we can verify Meta's HMAC signature before parsing.
  const raw = await request.text();

  // Authenticity: when WHATSAPP_APP_SECRET is set, require a valid
  // X-Hub-Signature-256 — otherwise anyone who knows the URL could POST fake
  // message events (inject leads, burn LLM/send budget). Fail-OPEN when the
  // secret is unset, matching the channel's ships-dark pattern.
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (appSecret) {
    const header = request.headers.get("x-hub-signature-256") || "";
    const provided = header.startsWith("sha256=") ? header.slice(7) : "";
    if (!(await verifyHmacSha256(appSecret, raw, provided))) {
      logEvent("bot.whatsapp.bad_signature", {}, "warn");
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  let update: WaUpdate;
  try {
    update = JSON.parse(raw) as WaUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    await handleUpdate(update);
  } catch (err) {
    logEvent("bot.whatsapp.error", { message: err instanceof Error ? err.message : String(err) }, "error");
  }
  // Always 200 so Meta considers the event delivered.
  return NextResponse.json({ ok: true });
}
