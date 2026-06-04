import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number, currency: "USD" | "UZS" = "USD"): string {
  if (currency === "UZS") {
    return new Intl.NumberFormat("uz-UZ", {
      style: "currency",
      currency: "UZS",
      maximumFractionDigits: 0,
    }).format(price);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatMileage(km: number): string {
  return new Intl.NumberFormat("ru-RU").format(km) + " км";
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("ru-RU").format(num);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatDate(value: string | Date, locale = "ru-RU"): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * Build a WhatsApp deep link with an optional pre-filled message.
 * Accepts either a full wa.me/api.whatsapp.com URL or a raw phone number,
 * so it works whether site-settings stores a URL or just digits.
 */
export function whatsappLink(whatsapp: string | undefined, message?: string): string {
  const raw = (whatsapp || "").trim();
  if (!raw) return "";
  let base = raw;
  if (!/^https?:\/\//i.test(base)) {
    const digits = base.replace(/[^0-9]/g, "");
    if (!digits) return "";
    base = `https://wa.me/${digits}`;
  }
  if (!message) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}text=${encodeURIComponent(message)}`;
}

/**
 * Normalize a Telegram contact into a t.me URL. Accepts a full t.me URL or an
 * @username / username. Telegram is the primary contact channel in Uzbekistan.
 * (t.me username/channel links can't carry a prefilled message — only the chat
 * opens — so no `text` param here.)
 */
export function telegramLink(telegram: string | undefined): string {
  const raw = (telegram || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, "").replace(/^t\.me\//i, "").trim();
  return handle ? `https://t.me/${handle}` : "";
}
