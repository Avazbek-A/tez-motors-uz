import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { CAR_BRANDS, DELIVERY_CITIES, SITE_CONFIG } from "@/lib/constants";
import { getLocaleFromCookie } from "@/i18n/config";
import { localizedAlternates, type SeoLocale } from "@/lib/seo/alternates";
import { localizedPath } from "@/lib/locale-path";
import { BreadcrumbSchema } from "@/components/shared/breadcrumb-schema";

/**
 * Multi-city SEO landing page: /city/[city].
 *
 * Captures geo-led search intent ("купить авто из Китая Самарканд") for cities
 * other than Tashkent. There is NO per-city inventory — every car ships from the
 * single Tashkent operation — so this is a localized, copy-rich landing page that
 * funnels to the shared catalog/order/contacts flow. Unique title/h1/intro per
 * city × locale keeps Google from treating these as duplicates.
 */

type City = (typeof DELIVERY_CITIES)[number];

const CITY_BY_SLUG = Object.fromEntries(DELIVERY_CITIES.map((c) => [c.slug, c])) as Record<string, City>;

function cityName(city: City, locale: SeoLocale): string {
  return city[locale];
}

function copy(city: City, locale: SeoLocale) {
  const name = cityName(city, locale);
  if (locale === "uz") {
    return {
      title: `${name}da Xitoydan avto import`,
      description: `Tez Motors ${name} uchun Xitoydan avtomobil import qiladi: tanlash, yetkazib berish, bojxona va kafolat. Toshkentdan ${name}ga yetkazish ${city.days} kun.`,
      h1: `${name}da Xitoydan avtomobil sotib oling`,
      intro: `${name} aholisi uchun Tez Motors Xitoydagi zavodlardan to'g'ridan-to'g'ri avtomobil import qiladi. Modelni tanlaymiz, spetsifikatsiyani kelishamiz, temir yo'l bilan Toshkentga olib kelamiz, bojxonadan o'tkazamiz va ${name}ga yetkazib beramiz — to'liq «kalit topshirish» sharti bilan.`,
      deliveryHeading: `${name}ga yetkazib berish`,
      deliveryBody: `Avtomobil Toshkent ombrimizdan ${name}ga avtovoz orqali odatda ${city.days} kun ichida yetkaziladi. Narx va muddatlar shaffof, yashirin to'lovlarsiz. Hujjatlarni masofadan rasmiylashtirish mumkin.`,
      brandsHeading: "Biz import qiladigan brendlar",
      catalogCta: "Katalogni ko'rish",
      orderCta: "Buyurtma berish",
      contactsCta: "Menejer bilan bog'lanish",
    };
  }
  if (locale === "en") {
    return {
      title: `Import Chinese cars in ${name}`,
      description: `Tez Motors imports cars from China for ${name}: sourcing, delivery, customs, warranty. Delivery from Tashkent to ${name} in ${city.days} days.`,
      h1: `Buy Chinese cars in ${name}`,
      intro: `For buyers in ${name}, Tez Motors imports cars direct from factories in China. We pick the model to spec, ship by rail to Tashkent, clear customs, and deliver to ${name} fully turn-key. Transparent pricing, no hidden fees.`,
      deliveryHeading: `Delivery to ${name}`,
      deliveryBody: `Your car is delivered from our Tashkent warehouse to ${name} by car carrier, typically within ${city.days} days. Pricing and timelines are transparent, and the paperwork can be handled remotely.`,
      brandsHeading: "Brands we import",
      catalogCta: "Browse the catalog",
      orderCta: "Order to import",
      contactsCta: "Talk to a manager",
    };
  }
  // Use "город {name}" so the proper noun stays nominative — avoids broken
  // Russian declension (e.g. "в Бухару" vs "в Бухара") across all 7 cities.
  return {
    title: `${name}: импорт авто из Китая`,
    description: `Tez Motors импортирует автомобили из Китая для жителей города ${name}: подбор, доставка, таможня, гарантия. Доставка из Ташкента в город ${name} за ${city.days} дня.`,
    h1: `Купить авто из Китая — ${name}`,
    intro: `Для покупателей из города ${name} Tez Motors импортирует автомобили напрямую с заводов Китая. Подбираем модель под запрос, доставляем по железной дороге в Ташкент, оформляем таможню и доставляем в город ${name} полностью готовый к эксплуатации автомобиль. Прозрачные цены без скрытых наценок.`,
    deliveryHeading: `Доставка в город ${name}`,
    deliveryBody: `Автомобиль доставляется с нашего склада в Ташкенте в город ${name} автовозом — обычно за ${city.days} дня. Цены и сроки прозрачны, документы можно оформить дистанционно.`,
    brandsHeading: "Бренды, которые мы импортируем",
    catalogCta: "Перейти в каталог",
    orderCta: "Заказать под импорт",
    contactsCta: "Связаться с менеджером",
  };
}

async function resolveLocale(): Promise<SeoLocale> {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  return (
    (requestHeaders.get("x-tez-locale") as SeoLocale | null) ??
    (getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value) as SeoLocale)
  );
}

// Only the 7 known cities are valid routes; anything else 404s (no soft-404).
export const dynamicParams = false;

export function generateStaticParams() {
  return DELIVERY_CITIES.map((c) => ({ city: c.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ city: string }> },
): Promise<Metadata> {
  const { city: slug } = await params;
  const city = CITY_BY_SLUG[slug];
  if (!city) return { title: "City not found" };
  const locale = await resolveLocale();
  const c = copy(city, locale);
  return {
    title: c.title,
    description: c.description,
    alternates: localizedAlternates(`/city/${slug}`, locale),
    openGraph: { title: c.title, description: c.description },
  };
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params;
  const city = CITY_BY_SLUG[slug];
  if (!city) notFound();
  const locale = await resolveLocale();
  const c = copy(city, locale);
  const name = cityName(city, locale);

  return (
    <div className="pt-24 pb-20">
      <BreadcrumbSchema
        items={[
          { name: locale === "ru" ? "Главная" : locale === "uz" ? "Bosh sahifa" : "Home", url: `${SITE_CONFIG.url}/${locale}` },
          { name, url: `${SITE_CONFIG.url}/${locale}/city/${slug}` },
        ]}
      />
      <div className="container-custom max-w-4xl">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">{c.h1}</h1>
        <p className="mt-6 text-base md:text-lg text-muted-foreground leading-relaxed">{c.intro}</p>

        <section className="mt-14">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">{c.deliveryHeading}</h2>
          <p className="text-muted-foreground leading-relaxed">{c.deliveryBody}</p>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">{c.brandsHeading}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {CAR_BRANDS.map((brand) => (
              <Link
                key={brand}
                href={localizedPath(locale, `/catalog/brand/${brand.toLowerCase().replace(/\s+/g, "-")}`)}
                className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
              >
                {brand}
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-12 flex flex-col sm:flex-row gap-3">
          <Link href={localizedPath(locale, "/catalog")} className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground">
            {c.catalogCta}
          </Link>
          <Link href={localizedPath(locale, "/order")} className="inline-flex items-center justify-center rounded-xl border border-border px-6 py-3 font-medium text-foreground/90 hover:bg-white/5">
            {c.orderCta}
          </Link>
          <Link href={localizedPath(locale, "/contacts")} className="inline-flex items-center justify-center rounded-xl border border-border px-6 py-3 font-medium text-foreground/90 hover:bg-white/5">
            {c.contactsCta}
          </Link>
        </div>
      </div>
    </div>
  );
}
