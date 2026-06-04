/**
 * Off-site listing copy (Phase AJ).
 *
 * Builds a classifieds-style listing (title + body) for a car, per channel and
 * locale, for the dealer to publish on OLX.uz / avtoelon.uz (copy-paste) or the
 * social channels. LLM-enhanced with a deterministic template fallback so it
 * never returns empty and works with no LLM key. Pure `listingFallback` is
 * unit-tested.
 */
import { llmText } from "./llm";

export type ListingChannel = "olx" | "avtoelon" | "telegram" | "instagram" | "facebook";
export type ListingLocale = "ru" | "uz" | "en";

export interface ListingCar {
  brand: string;
  model: string;
  year: number | null;
  price_usd: number | null;
  mileage: number | null;
  fuel_type: string | null;
  body_type: string | null;
  color: string | null;
  transmission?: string | null;
  description_ru?: string | null;
  listing_type?: string | null;
}

export interface ListingDraft {
  title: string;
  body: string;
}

function price(c: ListingCar): string {
  return c.price_usd ? `$${Math.round(c.price_usd).toLocaleString("en-US")}` : "—";
}

export function listingTitle(c: ListingCar): string {
  return [c.brand, c.model, c.year].filter(Boolean).join(" ");
}

const LABELS: Record<ListingLocale, Record<string, string>> = {
  ru: { price: "Цена", year: "Год", mileage: "Пробег", fuel: "Топливо", body: "Кузов", color: "Цвет", gearbox: "КПП", km: "км", turnkey: "Импорт «под ключ» от Tez Motors — подбор, доставка, растаможка, гарантия.", contact: "Звоните / пишите в WhatsApp." },
  uz: { price: "Narx", year: "Yil", mileage: "Yurgan masofa", fuel: "Yoqilg'i", body: "Kuzov", color: "Rang", gearbox: "Uzatma", km: "km", turnkey: "Tez Motors'dan «kalit topshirish» importi — tanlov, yetkazib berish, bojxona, kafolat.", contact: "Qo'ng'iroq qiling / WhatsApp'ga yozing." },
  en: { price: "Price", year: "Year", mileage: "Mileage", fuel: "Fuel", body: "Body", color: "Color", gearbox: "Gearbox", km: "km", turnkey: "Turn-key import by Tez Motors — sourcing, delivery, customs, warranty.", contact: "Call or message us on WhatsApp." },
};

/** Deterministic, no-LLM listing — also the fail-open fallback. */
export function listingFallback(c: ListingCar, _channel: ListingChannel, locale: ListingLocale = "ru"): ListingDraft {
  const t = LABELS[locale];
  const lines: string[] = [`${t.price}: ${price(c)}`];
  if (c.year) lines.push(`${t.year}: ${c.year}`);
  if (c.mileage != null) lines.push(`${t.mileage}: ${Math.round(c.mileage).toLocaleString("en-US")} ${t.km}`);
  if (c.fuel_type) lines.push(`${t.fuel}: ${c.fuel_type}`);
  if (c.body_type) lines.push(`${t.body}: ${c.body_type}`);
  if (c.transmission) lines.push(`${t.gearbox}: ${c.transmission}`);
  if (c.color) lines.push(`${t.color}: ${c.color}`);
  const body = [listingTitle(c), "", lines.join("\n"), "", t.turnkey, t.contact].join("\n");
  return { title: listingTitle(c), body };
}

const LOCALE_NAME: Record<ListingLocale, string> = { ru: "Russian", uz: "Uzbek (Latin)", en: "English" };
const CHANNEL_GUIDANCE: Record<ListingChannel, string> = {
  olx: "a classifieds listing for OLX.uz: a spec list and 2-3 selling sentences, no hashtags.",
  avtoelon: "a classifieds listing for avtoelon.uz: a spec list and 2-3 selling sentences, no hashtags.",
  telegram: "a punchy Telegram post: a hook, a few spec lines, a call to action, 3-5 hashtags.",
  instagram: "an Instagram caption: a hook, benefit lines, a call to action, then 8-12 hashtags.",
  facebook: "a friendly Facebook post: 2-3 short paragraphs, a call to action.",
};

export async function generateListing(
  c: ListingCar,
  channel: ListingChannel,
  locale: ListingLocale = "ru",
): Promise<ListingDraft & { ai: boolean }> {
  const fallback = listingFallback(c, channel, locale);
  const facts = listingFallback(c, channel, locale).body; // spec block as grounding
  const system = [
    "You are the marketing copywriter for Tez Motors, a Chinese-car importer in Tashkent, Uzbekistan.",
    `Write in ${LOCALE_NAME[locale]}.`,
    `Write ${CHANNEL_GUIDANCE[channel]}`,
    "Ground every claim in the facts given. NEVER invent prices, specs, discounts, or guarantees. Output ONLY the listing text, no preamble.",
  ].join(" ");
  const user = `Car facts:\n${facts}`;
  const out = await llmText({ system, user, maxTokens: 400 });
  if (!out || !out.trim()) return { ...fallback, ai: false };
  return { title: fallback.title, body: out.trim(), ai: true };
}
