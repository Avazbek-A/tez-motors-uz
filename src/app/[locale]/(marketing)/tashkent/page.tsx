import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { CAR_BRANDS, SITE_CONFIG } from "@/lib/constants";
import { getLocaleFromCookie } from "@/i18n/config";
import { localizedAlternates, type SeoLocale } from "@/lib/seo/alternates";
import { localizedPath } from "@/lib/locale-path";
import { BreadcrumbSchema } from "@/components/shared/breadcrumb-schema";

const COPY: Record<
  SeoLocale,
  {
    title: string;
    description: string;
    h1: string;
    intro: string;
    brandsHeading: string;
    deliveryHeading: string;
    deliveryBody: string;
    contactsCta: string;
    catalogCta: string;
  }
> = {
  ru: {
    title: "Импорт авто из Китая в Ташкенте — Tez Motors",
    description:
      "Tez Motors — импорт автомобилей из Китая в Ташкенте и по всему Узбекистану. Подбор, доставка, таможня, гарантия. BYD, Chery, Haval, Geely и другие.",
    h1: "Купить авто из Китая в Ташкенте",
    intro:
      "Tez Motors — официальный импортёр китайских автомобилей в Ташкенте. Мы работаем напрямую с заводами в Китае: подбираем модель под запрос, согласуем спецификацию, оплачиваем, доставляем по железной дороге, оформляем таможню и передаём вам полностью готовый к эксплуатации автомобиль. Прозрачные цены без скрытых наценок и фиксированный срок доставки.",
    brandsHeading: "Бренды, которые мы импортируем",
    deliveryHeading: "Доставка по Узбекистану",
    deliveryBody:
      "Самовывоз из офиса в Ташкенте бесплатный. Доставку в Самарканд, Бухару, Андижан, Фергану, Намангану и другие города согласовываем индивидуально — обычно автовозом за 1–3 дня.",
    contactsCta: "Связаться с менеджером",
    catalogCta: "Перейти в каталог",
  },
  uz: {
    title: "Toshkentda Xitoydan avto import — Tez Motors",
    description:
      "Tez Motors — Toshkent va butun O'zbekiston bo'ylab Xitoydan avtomobil import qiluvchi kompaniya. Tanlash, yetkazib berish, bojxona, kafolat. BYD, Chery, Haval, Geely va boshqalar.",
    h1: "Toshkentda Xitoydan avtomobil sotib oling",
    intro:
      "Tez Motors — Toshkentda xitoy avtomobillarini rasmiy import qiluvchi kompaniya. Biz Xitoydagi zavodlar bilan to'g'ridan-to'g'ri ishlaymiz: modelni tanlaymiz, spetsifikatsiyani kelishamiz, to'lovni amalga oshiramiz, temir yo'l bilan yetkazib beramiz, bojxonadan o'tkazamiz va to'liq tayyor avtomobilni topshiramiz. Shaffof narxlar va aniq muddatlar.",
    brandsHeading: "Biz import qiladigan brendlar",
    deliveryHeading: "O'zbekiston bo'ylab yetkazib berish",
    deliveryBody:
      "Toshkent ofisidan olib ketish bepul. Samarqand, Buxoro, Andijon, Farg'ona, Namangan va boshqa shaharlarga yetkazib berish — odatda 1–3 kun ichida avtovoz orqali.",
    contactsCta: "Menejer bilan bog'lanish",
    catalogCta: "Katalogga o'tish",
  },
  en: {
    title: "Import Chinese cars in Tashkent — Tez Motors",
    description:
      "Tez Motors imports cars from China across Tashkent and Uzbekistan. Sourcing, shipping, customs, warranty. BYD, Chery, Haval, Geely, and more.",
    h1: "Buy Chinese cars in Tashkent",
    intro:
      "Tez Motors is the trusted importer of Chinese cars in Tashkent. We work direct with factories in China: pick the model to spec, place the order, ship by rail, clear customs, and hand over a turn-key car. Transparent pricing, no hidden fees, fixed delivery windows.",
    brandsHeading: "Brands we import",
    deliveryHeading: "Delivery across Uzbekistan",
    deliveryBody:
      "Pickup from our Tashkent office is free. Delivery to Samarkand, Bukhara, Andijan, Fergana, Namangan, and other cities is arranged individually — typically by car carrier within 1–3 days.",
    contactsCta: "Talk to a manager",
    catalogCta: "Browse the catalog",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as SeoLocale | null) ??
    (getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value) as SeoLocale);

  const c = COPY[locale];
  return {
    title: c.title,
    description: c.description,
    alternates: localizedAlternates("/tashkent", locale),
    openGraph: { title: c.title, description: c.description },
  };
}

export default async function TashkentPage() {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as SeoLocale | null) ??
    (getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value) as SeoLocale);

  const c = COPY[locale];

  return (
    <div className="pt-24 pb-20">
      <BreadcrumbSchema
        items={[
          {
            name: locale === "ru" ? "Главная" : locale === "uz" ? "Bosh sahifa" : "Home",
            url: `${SITE_CONFIG.url}/${locale}`,
          },
          { name: "Tashkent", url: `${SITE_CONFIG.url}/${locale}/tashkent` },
        ]}
      />
      <div className="container-custom max-w-4xl">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gradient">
          {c.h1}
        </h1>
        <p className="mt-6 text-base md:text-lg text-white/70 leading-relaxed">{c.intro}</p>

        <section className="mt-14">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
            {c.brandsHeading}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {CAR_BRANDS.map((brand) => (
              <Link
                key={brand}
                href={localizedPath(
                  locale,
                  `/catalog/brand/${brand.toLowerCase().replace(/\s+/g, "-")}`,
                )}
                className="rounded-xl border border-white/10 bg-[#0d0d15] px-4 py-3 text-sm text-white/80 hover:border-cyan-400/40 hover:text-white transition-colors"
              >
                {brand}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            {c.deliveryHeading}
          </h2>
          <p className="text-white/70 leading-relaxed">{c.deliveryBody}</p>
        </section>

        <div className="mt-12 flex flex-col sm:flex-row gap-3">
          <Link
            href={localizedPath(locale, "/contacts")}
            className="inline-flex items-center justify-center rounded-xl bg-neon-blue px-6 py-3 font-medium text-white"
          >
            {c.contactsCta}
          </Link>
          <Link
            href={localizedPath(locale, "/catalog")}
            className="inline-flex items-center justify-center rounded-xl border border-white/15 px-6 py-3 font-medium text-white/90 hover:bg-white/5"
          >
            {c.catalogCta}
          </Link>
        </div>
      </div>
    </div>
  );
}
