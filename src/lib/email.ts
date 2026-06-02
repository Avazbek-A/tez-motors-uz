/**
 * Transactional email via the Resend HTTP API (single fetch — Workers-safe,
 * no node-only SMTP/TCP deps).
 *
 * Fail-open by design, mirroring src/lib/telegram.ts: if RESEND_API_KEY is
 * unset the call is skipped and the caller proceeds. Email must never break a
 * request — a failed send is logged and swallowed.
 *
 * Owner provisions (Worker secrets): RESEND_API_KEY, EMAIL_FROM (a sender on a
 * domain verified in Resend), DEALER_EMAIL (where dealer alerts land).
 */

export type EmailLocale = "ru" | "uz" | "en";

const BRAND = "Tez Motors";

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://tezmotors.uz").replace(/\/$/, "");
}

export interface SendEmailArgs {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

/**
 * Send one email. Returns { ok } — ok=false when skipped (no key) or failed.
 * Never throws.
 */
export async function sendEmail(args: SendEmailArgs): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { ok: false };

  const to = Array.isArray(args.to) ? args.to : [args.to];
  if (to.length === 0 || to.some((a) => !a || !a.includes("@"))) return { ok: false };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: args.subject,
        html: args.html,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Resend non-OK", res.status, body.slice(0, 500));
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error("Resend send failed", err);
    return { ok: false };
  }
}

/** Escape user-supplied strings before interpolating into HTML. */
function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Shared, inline-styled shell so emails render consistently without a CSS dep. */
function layout(bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#18181b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">
      <tr><td style="background:#0a0a0f;padding:20px 24px"><a href="${siteUrl()}" style="color:#ffffff;font-size:20px;font-weight:bold;text-decoration:none">${BRAND}</a></td></tr>
      <tr><td style="padding:24px">${bodyHtml}</td></tr>
      <tr><td style="padding:16px 24px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a">
        ${BRAND} · <a href="${siteUrl()}" style="color:#71717a">${siteUrl().replace(/^https?:\/\//, "")}</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:8px;padding:10px 18px;background:#0a0a0f;color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px">${esc(label)}</a>`;
}

type Template = { subject: string; html: string };

/** "We received your request" — sent to the customer when they leave an email. */
export function inquiryReceivedEmail(locale: EmailLocale, data: { name?: string }): Template {
  const name = data.name ? esc(data.name) : "";
  const copy = {
    ru: {
      subject: `${BRAND}: мы получили вашу заявку`,
      hi: name ? `Здравствуйте, ${name}!` : "Здравствуйте!",
      body: "Спасибо за обращение. Мы получили вашу заявку и свяжемся с вами в ближайшее время.",
      cta: "Смотреть каталог",
    },
    uz: {
      subject: `${BRAND}: arizangiz qabul qilindi`,
      hi: name ? `Assalomu alaykum, ${name}!` : "Assalomu alaykum!",
      body: "Murojaatingiz uchun rahmat. Arizangizni qabul qildik va tez orada siz bilan bog'lanamiz.",
      cta: "Katalogni ko'rish",
    },
    en: {
      subject: `${BRAND}: we received your request`,
      hi: name ? `Hello, ${name}!` : "Hello!",
      body: "Thanks for reaching out. We received your request and will contact you shortly.",
      cta: "Browse catalog",
    },
  }[locale];
  return {
    subject: copy.subject,
    html: layout(
      `<p style="margin:0 0 12px;font-size:16px;font-weight:bold">${copy.hi}</p>
       <p style="margin:0 0 16px;font-size:14px;line-height:1.6">${copy.body}</p>
       ${btn(`${siteUrl()}/${locale}/catalog`, copy.cta)}`,
    ),
  };
}

/** Welcome / confirmation for a newsletter subscriber. */
export function newsletterWelcomeEmail(locale: EmailLocale): Template {
  const copy = {
    ru: {
      subject: `${BRAND}: подписка оформлена`,
      title: "Вы подписались на рассылку",
      body: "Будем присылать вам новые поступления, спецпредложения и снижения цен. Спасибо, что вы с нами!",
      cta: "Смотреть авто",
    },
    uz: {
      subject: `${BRAND}: obuna rasmiylashtirildi`,
      title: "Siz yangiliklarga obuna bo'ldingiz",
      body: "Sizga yangi kelgan avtomobillar, maxsus takliflar va narx pasayishlarini yuboramiz. Biz bilan bo'lganingiz uchun rahmat!",
      cta: "Avtomobillarni ko'rish",
    },
    en: {
      subject: `${BRAND}: you're subscribed`,
      title: "You're subscribed",
      body: "We'll send you new arrivals, special offers and price drops. Thanks for joining!",
      cta: "Browse cars",
    },
  }[locale];
  return {
    subject: copy.subject,
    html: layout(
      `<p style="margin:0 0 12px;font-size:16px;font-weight:bold">${copy.title}</p>
       <p style="margin:0 0 16px;font-size:14px;line-height:1.6">${copy.body}</p>
       ${btn(`${siteUrl()}/${locale}/catalog`, copy.cta)}`,
    ),
  };
}

/** Price-drop alert — the buyer who watched this car finally hit their target. */
export function priceDropAlertEmail(
  locale: EmailLocale,
  data: { carName: string; newPrice: number; targetPrice: number; slug: string },
): Template {
  const car = esc(data.carName);
  const price = `$${Math.round(data.newPrice).toLocaleString("en-US")}`;
  const url = `${siteUrl()}/${locale}/catalog/${encodeURIComponent(data.slug)}`;
  const copy = {
    ru: {
      subject: `Цена снижена: ${data.carName} — ${price}`,
      title: "Цена на отслеживаемое авто снизилась",
      body: `${car} теперь стоит ${price} — в пределах вашей цели. Успейте, пока авто в наличии.`,
      cta: "Открыть авто",
    },
    uz: {
      subject: `Narx tushdi: ${data.carName} — ${price}`,
      title: "Kuzatilayotgan avtomobil narxi tushdi",
      body: `${car} endi ${price} — sizning maqsadingiz doirasida. Avtomobil mavjud ekan, ulguring.`,
      cta: "Avtomobilni ochish",
    },
    en: {
      subject: `Price drop: ${data.carName} — ${price}`,
      title: "A car you're watching dropped in price",
      body: `${car} is now ${price} — within your target. Act while it's still available.`,
      cta: "View the car",
    },
  }[locale];
  return {
    subject: copy.subject,
    html: layout(
      `<p style="margin:0 0 12px;font-size:16px;font-weight:bold">${copy.title}</p>
       <p style="margin:0 0 16px;font-size:14px;line-height:1.6">${copy.body}</p>
       ${btn(url, copy.cta)}`,
    ),
  };
}

/** Saved-search match alert — new cars arrived that match a search the customer saved (Phase X3). */
export function savedSearchAlertEmail(
  locale: EmailLocale,
  data: { label?: string | null; cars: Array<{ name: string; price: number; slug: string }>; total: number },
): Template {
  const label = data.label ? esc(data.label) : "";
  const copy = {
    ru: {
      subject: data.total === 1 ? "Новое авто по вашему поиску" : `${data.total} новых авто по вашему поиску`,
      title: "Появились новые авто по сохранённому поиску",
      intro: label ? `Поиск «${label}»: новые поступления.` : "Появились новые авто, подходящие под ваш поиск.",
      cta: "Смотреть каталог",
    },
    uz: {
      subject: data.total === 1 ? "Qidiruvingiz bo'yicha yangi avtomobil" : `Qidiruvingiz bo'yicha ${data.total} ta yangi avtomobil`,
      title: "Saqlangan qidiruvingiz bo'yicha yangi avtomobillar",
      intro: label ? `«${label}» qidiruvi: yangi kelganlar.` : "Qidiruvingizga mos yangi avtomobillar paydo bo'ldi.",
      cta: "Katalogni ko'rish",
    },
    en: {
      subject: data.total === 1 ? "A new car matches your search" : `${data.total} new cars match your search`,
      title: "New cars match your saved search",
      intro: label ? `Search "${label}": new arrivals.` : "New cars matching your saved search just arrived.",
      cta: "Browse catalog",
    },
  }[locale];

  const items = data.cars
    .slice(0, 6)
    .map((c) => {
      const url = `${siteUrl()}/${locale}/catalog/${encodeURIComponent(c.slug)}`;
      const price = `$${Math.round(c.price).toLocaleString("en-US")}`;
      return `<tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px">
        <a href="${url}" style="color:#0a0a0f;text-decoration:none;font-weight:bold">${esc(c.name)}</a>
        <span style="color:#71717a"> — ${price}</span>
      </td></tr>`;
    })
    .join("");

  return {
    subject: copy.subject,
    html: layout(
      `<p style="margin:0 0 12px;font-size:16px;font-weight:bold">${copy.title}</p>
       <p style="margin:0 0 12px;font-size:14px;line-height:1.6">${copy.intro}</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
       <div style="margin-top:16px">${btn(`${siteUrl()}/${locale}/catalog`, copy.cta)}</div>`,
    ),
  };
}

/** Post-delivery review request — sent N days after an order is delivered (Phase Y4). */
export function reviewRequestEmail(
  locale: EmailLocale,
  data: { name?: string; carName?: string; reviewUrl: string },
): Template {
  const name = data.name ? esc(data.name) : "";
  const car = data.carName ? esc(data.carName) : "";
  const copy = {
    ru: {
      subject: `${BRAND}: поделитесь впечатлением о покупке`,
      hi: name ? `Здравствуйте, ${name}!` : "Здравствуйте!",
      body: car
        ? `Поздравляем с покупкой ${car}! Расскажите, как впечатления — ваш отзыв поможет другим покупателям.`
        : "Поздравляем с покупкой! Расскажите, как впечатления — ваш отзыв поможет другим покупателям.",
      cta: "Оставить отзыв",
    },
    uz: {
      subject: `${BRAND}: xaridingiz haqida fikr bildiring`,
      hi: name ? `Assalomu alaykum, ${name}!` : "Assalomu alaykum!",
      body: car
        ? `${car} xaridingiz bilan tabriklaymiz! Taassurotlaringizni baham ko'ring — fikringiz boshqa xaridorlarga yordam beradi.`
        : "Xaridingiz bilan tabriklaymiz! Taassurotlaringizni baham ko'ring — fikringiz boshqa xaridorlarga yordam beradi.",
      cta: "Fikr qoldirish",
    },
    en: {
      subject: `${BRAND}: share your experience`,
      hi: name ? `Hello, ${name}!` : "Hello!",
      body: car
        ? `Congratulations on your ${car}! Tell us how it's going — your review helps other buyers.`
        : "Congratulations on your purchase! Tell us how it's going — your review helps other buyers.",
      cta: "Leave a review",
    },
  }[locale];
  return {
    subject: copy.subject,
    html: layout(
      `<p style="margin:0 0 12px;font-size:16px;font-weight:bold">${copy.hi}</p>
       <p style="margin:0 0 16px;font-size:14px;line-height:1.6">${copy.body}</p>
       ${btn(data.reviewUrl, copy.cta)}`,
    ),
  };
}

/** Order status change — sent to the customer as their import progresses (Phase O). */
/**
 * Nudge a customer whose reservation is still unpaid — sent once by the
 * recovery cron after the reminder delay, before the release deadline.
 */
export function reservationReminderEmail(
  locale: EmailLocale,
  data: { name?: string; carName: string; trackUrl: string; hoursLeft: number },
): Template {
  const name = data.name ? esc(data.name) : "";
  const car = esc(data.carName);
  const hrs = Math.max(1, Math.round(data.hoursLeft));
  const copy = {
    ru: {
      subject: `${BRAND}: завершите бронирование ${car}`,
      hi: name ? `Здравствуйте, ${name}!` : "Здравствуйте!",
      body: `Автомобиль <b>${car}</b> пока забронирован за вами. Чтобы закрепить его, внесите депозит онлайн.`,
      warn: `Если депозит не поступит в течение ~${hrs} ч, бронь снимется и автомобиль вернётся в продажу.`,
      cta: "Завершить и внести депозит",
    },
    uz: {
      subject: `${BRAND}: ${car} bronini yakunlang`,
      hi: name ? `Assalomu alaykum, ${name}!` : "Assalomu alaykum!",
      body: `<b>${car}</b> avtomobili hozircha siz uchun band qilingan. Uni mustahkamlash uchun depozitni onlayn to'lang.`,
      warn: `Agar depozit ~${hrs} soat ichida kelib tushmasa, bron bekor qilinadi va avtomobil sotuvga qaytadi.`,
      cta: "Yakunlash va depozit to'lash",
    },
    en: {
      subject: `${BRAND}: finish reserving the ${car}`,
      hi: name ? `Hello, ${name}!` : "Hello!",
      body: `The <b>${car}</b> is still held for you. Pay the deposit online to lock it in.`,
      warn: `If the deposit isn't received within ~${hrs}h, the hold is released and the car returns to sale.`,
      cta: "Finish & pay deposit",
    },
  }[locale];
  return {
    subject: copy.subject,
    html: layout(
      `<p style="margin:0 0 12px;font-size:16px;font-weight:bold">${copy.hi}</p>
       <p style="margin:0 0 8px;font-size:14px;line-height:1.6">${copy.body}</p>
       <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#a16207">${copy.warn}</p>
       ${btn(data.trackUrl, copy.cta)}`,
    ),
  };
}

/** Tell a customer their unpaid reservation expired and the car is available again. */
export function reservationReleasedEmail(
  locale: EmailLocale,
  data: { name?: string; carName: string },
): Template {
  const name = data.name ? esc(data.name) : "";
  const car = esc(data.carName);
  const url = `${siteUrl()}/${locale}/catalog`;
  const copy = {
    ru: {
      subject: `${BRAND}: бронь ${car} снята`,
      hi: name ? `Здравствуйте, ${name}!` : "Здравствуйте!",
      body: `Срок бронирования <b>${car}</b> истёк, и автомобиль снова доступен. Если вы всё ещё заинтересованы — забронируйте снова, мы будем рады помочь.`,
      cta: "Открыть каталог",
    },
    uz: {
      subject: `${BRAND}: ${car} broni bekor qilindi`,
      hi: name ? `Assalomu alaykum, ${name}!` : "Assalomu alaykum!",
      body: `<b>${car}</b> bron muddati tugadi va avtomobil yana mavjud. Agar hali ham qiziqsangiz — qayta bron qiling, yordam berishdan mamnunmiz.`,
      cta: "Katalogni ochish",
    },
    en: {
      subject: `${BRAND}: your hold on the ${car} expired`,
      hi: name ? `Hello, ${name}!` : "Hello!",
      body: `Your reservation for the <b>${car}</b> has expired and the car is available again. If you're still interested, reserve it again — we're happy to help.`,
      cta: "Browse catalog",
    },
  }[locale];
  return {
    subject: copy.subject,
    html: layout(
      `<p style="margin:0 0 12px;font-size:16px;font-weight:bold">${copy.hi}</p>
       <p style="margin:0 0 16px;font-size:14px;line-height:1.6">${copy.body}</p>
       ${btn(url, copy.cta)}`,
    ),
  };
}

export function orderStatusChangedEmail(
  locale: EmailLocale,
  data: { carName: string; statusLabel: string; referenceCode: string; note?: string },
): Template {
  const car = esc(data.carName);
  const code = esc(data.referenceCode);
  const note = data.note ? esc(data.note) : "";
  const url = `${siteUrl()}/${locale}/track?code=${encodeURIComponent(data.referenceCode)}`;
  const copy = {
    ru: {
      subject: `Статус заказа ${data.referenceCode}: ${data.statusLabel}`,
      title: "Обновление по вашему заказу",
      line: `${car} — новый статус: <b>${esc(data.statusLabel)}</b>.`,
      ref: `Номер заказа: <b>${code}</b>`,
      cta: "Отследить заказ",
    },
    uz: {
      subject: `Buyurtma holati ${data.referenceCode}: ${data.statusLabel}`,
      title: "Buyurtmangiz bo'yicha yangilanish",
      line: `${car} — yangi holat: <b>${esc(data.statusLabel)}</b>.`,
      ref: `Buyurtma raqami: <b>${code}</b>`,
      cta: "Buyurtmani kuzatish",
    },
    en: {
      subject: `Order ${data.referenceCode} status: ${data.statusLabel}`,
      title: "An update on your order",
      line: `${car} — new status: <b>${esc(data.statusLabel)}</b>.`,
      ref: `Order reference: <b>${code}</b>`,
      cta: "Track order",
    },
  }[locale];
  return {
    subject: copy.subject,
    html: layout(
      `<p style="margin:0 0 12px;font-size:16px;font-weight:bold">${copy.title}</p>
       <p style="margin:0 0 8px;font-size:14px;line-height:1.6">${copy.line}</p>
       ${note ? `<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#3f3f46">${note}</p>` : ""}
       <p style="margin:0 0 16px;font-size:13px;color:#71717a">${copy.ref}</p>
       ${btn(url, copy.cta)}`,
    ),
  };
}
