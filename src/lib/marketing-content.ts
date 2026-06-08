/**
 * Marketing content generation — AI-drafted social posts, ad copy, blog
 * articles and promos, grounded on real inventory, multi-language (ru/uz/en).
 * Pure prompt/fallback helpers are unit-tested; generateMarketingContent wraps
 * the LLM and falls back to a clean template so it never returns empty.
 */
import type { Locale } from "@/i18n/config";
import { llmText } from "./llm";
import { mergeHashtags, trendingTagBudget } from "./marketing-hashtags";

export type ContentKind = "telegram" | "instagram" | "facebook" | "ad" | "blog" | "promo";
export type ContentLocale = "ru" | "uz" | "en";

export interface ContentKindDef {
  key: ContentKind;
  label: string;
  maxTokens: number;
  guidance: string;
}

export const CONTENT_KINDS: ContentKindDef[] = [
  { key: "telegram", label: "Telegram post", maxTokens: 350, guidance: "A punchy Telegram channel post with a clear hook, 2–4 short lines, 1 emoji max per line, and a call to action. End with 3–5 relevant hashtags." },
  { key: "instagram", label: "Instagram caption", maxTokens: 350, guidance: "An engaging Instagram caption: a hook line, a few benefit lines, a call to action, then 8–12 hashtags on a new line." },
  { key: "facebook", label: "Facebook post", maxTokens: 350, guidance: "A friendly Facebook post, 2–3 short paragraphs, conversational, with a call to action. Few or no hashtags." },
  { key: "ad", label: "Ad copy", maxTokens: 250, guidance: "Short paid-ad copy: one headline (max 40 chars), one primary text (max 125 chars), and one call-to-action button label. Label each line." },
  { key: "blog", label: "Blog article", maxTokens: 1200, guidance: "A 400–600 word blog article with a title, an intro, 2–3 subheadings, and a closing call to action. Informative and trustworthy." },
  { key: "promo", label: "Promo announcement", maxTokens: 300, guidance: "A time-limited offer announcement: urgency, the deal, and a clear call to action. Keep it honest — do not invent discounts not provided." },
];

/**
 * Localized content-kind names for display. `en` mirrors the canonical
 * CONTENT_KINDS[].label — DO NOT diverge it: that English label is also used to
 * build the LLM prompt server-side (`Write ${def.label} about...`). Same key
 * set across every locale.
 */
const CONTENT_KIND_LABELS_I18N: Record<Locale, Record<ContentKind, string>> = {
  ru: {
    telegram: "Пост в Telegram",
    instagram: "Подпись в Instagram",
    facebook: "Пост в Facebook",
    ad: "Рекламный текст",
    blog: "Статья в блог",
    promo: "Промо-анонс",
  },
  uz: {
    telegram: "Telegram posti",
    instagram: "Instagram sarlavhasi",
    facebook: "Facebook posti",
    ad: "Reklama matni",
    blog: "Blog maqolasi",
    promo: "Aksiya e'loni",
  },
  en: {
    telegram: "Telegram post",
    instagram: "Instagram caption",
    facebook: "Facebook post",
    ad: "Ad copy",
    blog: "Blog article",
    promo: "Promo announcement",
  },
};

/**
 * Human label for a content kind. When `locale` is omitted, returns the
 * canonical English label from CONTENT_KINDS (stable for any non-display
 * callers); pass a locale to localize for display only.
 */
export function contentKindLabel(k: string, locale?: Locale): string {
  if (locale) {
    return CONTENT_KIND_LABELS_I18N[locale]?.[k as ContentKind] ?? contentKindLabel(k);
  }
  return CONTENT_KINDS.find((c) => c.key === k)?.label ?? k;
}
export function isContentKind(k: string): k is ContentKind {
  return CONTENT_KINDS.some((c) => c.key === k);
}

export interface ContentCar {
  brand: string;
  model: string;
  year?: number | null;
  price_usd?: number | null;
  body_type?: string | null;
  fuel_type?: string | null;
}

export interface ContentSubject {
  car?: ContentCar | null;
  topic?: string | null;
  tone?: string | null;
  /** Real trending hashtags (from Instagram research) to blend into social copy. */
  trendingHashtags?: string[] | null;
}

const LOCALE_NAME: Record<ContentLocale, string> = { ru: "Russian", uz: "Uzbek (Latin script)", en: "English" };

export function carHeadline(car: ContentCar): string {
  const price = car.price_usd ? ` — $${Number(car.price_usd).toLocaleString("en-US")}` : "";
  return `${car.brand} ${car.model}${car.year ? ` ${car.year}` : ""}${price}`;
}

export function subjectText(subject: ContentSubject): string {
  if (subject.car) {
    const c = subject.car;
    return [carHeadline(c), c.body_type, c.fuel_type].filter(Boolean).join(" · ");
  }
  return (subject.topic || "").trim();
}

/** Deterministic fallback so content is produced even without an LLM key. */
export function fallbackContent(kind: ContentKind, locale: ContentLocale, subject: ContentSubject): string {
  const subj = subjectText(subject) || "Tez Motors";
  const cta = { ru: "Пишите нам — подберём и привезём под ключ.", uz: "Bizga yozing — tanlab, kalit topshirish sharti bilan olib kelamiz.", en: "Message us — we source and deliver turnkey." }[locale];
  const tagline = { ru: "Импорт авто из Китая с Tez Motors", uz: "Xitoydan avto import — Tez Motors", en: "Car import from China with Tez Motors" }[locale];
  if (kind === "blog") {
    return `# ${subj}\n\n${tagline}.\n\n${cta}`;
  }
  const tags = kind === "instagram" ? "\n\n#tezmotors #avto #toshkent #importauto #китайскиеавто" : kind === "telegram" ? "\n\n#tezmotors #avto #toshkent" : "";
  return `${subj}\n\n${tagline}.\n${cta}${tags}`;
}

export async function generateMarketingContent(
  kind: ContentKind,
  locale: ContentLocale,
  subject: ContentSubject,
): Promise<{ text: string; ai: boolean }> {
  const def = CONTENT_KINDS.find((c) => c.key === kind)!;
  const subj = subjectText(subject);
  if (!subj) return { text: fallbackContent(kind, locale, subject), ai: false };

  const system = [
    `You are the marketing copywriter for Tez Motors, a Chinese-car importer in Tashkent, Uzbekistan.`,
    `Write in ${LOCALE_NAME[locale]}.`,
    def.guidance,
    subject.tone ? `Tone: ${subject.tone}.` : "Tone: confident, trustworthy, not spammy.",
    `Ground every claim in the facts given. NEVER invent prices, specs, discounts, or guarantees. Output ONLY the content, no preamble.`,
  ].join(" ");

  const user = subject.car
    ? `Write ${def.label} about this car we have for import: ${subjectText(subject)}.`
    : `Write ${def.label} about: ${subj}.`;

  const out = await llmText({ system, user, maxTokens: def.maxTokens });
  const base = out ? out.trim() : fallbackContent(kind, locale, subject);
  // Blend in real trending hashtags (deduped) for the social kinds.
  const text = mergeHashtags(base, subject.trendingHashtags, trendingTagBudget(kind));
  return { text, ai: Boolean(out) };
}
