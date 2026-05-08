import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { SITE_CONFIG } from "@/lib/constants";
import { getLocaleFromCookie } from "@/i18n/config";
import { localizedAlternates, type SeoLocale } from "@/lib/seo/alternates";
import { BreadcrumbSchema } from "@/components/shared/breadcrumb-schema";
import CatalogContent from "../../_content";
import type { CarFilters } from "@/types/car";

/**
 * Intent-led filter landing pages — `/catalog/electric`, `/catalog/suv`,
 * etc. Stable canonical URLs for queries like "электромобили Узбекистан"
 * or "купить SUV в Ташкенте" that don't fit a single brand.
 *
 * Adding a new slug only requires extending the FILTER_MAP + COPY tables.
 */

const FILTER_MAP: Record<string, CarFilters> = {
  electric: { fuel_type: "electric" },
  hybrid: { fuel_type: "hybrid" },
  phev: { fuel_type: "phev" },
  suv: { body_type: "suv" },
  sedan: { body_type: "sedan" },
  crossover: { body_type: "crossover" },
};

const COPY: Record<
  string,
  Record<SeoLocale, { title: string; description: string; intro: string }>
> = {
  electric: {
    ru: {
      title: "Электромобили из Китая в Узбекистане — Tez Motors",
      description:
        "Электромобили BYD, NIO, Zeekr, XPeng и другие. Импорт под ключ из Китая. Дальность хода, цены, гарантия.",
      intro:
        "Электрокары становятся базовым выбором: ноль топлива, минимум обслуживания, бесплатная парковка во многих ТЦ Ташкента. Импортируем электромобили напрямую с заводов в Китае.",
    },
    uz: {
      title: "Xitoydan elektromobillar — Tez Motors",
      description:
        "BYD, NIO, Zeekr, XPeng va boshqa elektr avtomobillar. Xitoydan to'liq import. Yurish masofasi, narxlar, kafolat.",
      intro:
        "Elektrokarlar — bugungi tanlov: yoqilg'isiz, kam xizmat ko'rsatish, Toshkent savdo markazlarida bepul to'xtash. Xitoy zavodlaridan to'g'ridan-to'g'ri import qilamiz.",
    },
    en: {
      title: "Electric cars from China — Tez Motors Uzbekistan",
      description:
        "BYD, NIO, Zeekr, XPeng and more electric cars. Turn-key import from China. Range, prices, warranty.",
      intro:
        "EVs are now the default: zero fuel cost, low maintenance, free parking in most Tashkent malls. We import electric cars direct from Chinese factories.",
    },
  },
  hybrid: {
    ru: {
      title: "Гибриды из Китая — Tez Motors",
      description:
        "Гибридные автомобили BYD, Geely, Haval. Экономия топлива, надёжность, импорт под ключ.",
      intro:
        "Гибрид совмещает экономичность электромотора с привычным запасом хода. Подбираем под ваш бюджет и сценарий езды по Ташкенту и за городом.",
    },
    uz: {
      title: "Xitoydan gibrid avtomobillar — Tez Motors",
      description:
        "BYD, Geely, Haval gibridlari. Yoqilg'i tejamkorligi, ishonchlilik, to'liq import.",
      intro:
        "Gibrid — elektr motorning tejamkorligini odatdagi yurish masofasi bilan birlashtiradi. Byudjetingiz va haydash uslubingizga moslab tanlaymiz.",
    },
    en: {
      title: "Hybrid cars from China — Tez Motors",
      description:
        "BYD, Geely, Haval hybrid cars. Fuel savings, reliability, full-cycle import.",
      intro:
        "Hybrids pair the efficiency of an electric motor with the familiar driving range. We help match the right model to your budget and driving habits.",
    },
  },
  phev: {
    ru: {
      title: "Plug-in гибриды из Китая — Tez Motors",
      description:
        "PHEV: запас хода 100+ км на электротяге, бензин в резерве. BYD Song, Haval H6 GT и другие.",
      intro:
        "Plug-in гибриды — гибкое решение: ежедневные поездки на электричестве, дальние — на бензине. Импортируем под заказ с гарантией.",
    },
    uz: {
      title: "Xitoydan plug-in gibridlar — Tez Motors",
      description:
        "PHEV: elektr quvvatida 100+ km, benzin zaxirada. BYD Song, Haval H6 GT va boshqalar.",
      intro:
        "Plug-in gibridlar — moslashuvchan yechim: kundalik yurish elektrda, uzoq yo'l benzinda. Buyurtma asosida import qilamiz.",
    },
    en: {
      title: "Plug-in hybrids from China — Tez Motors",
      description:
        "PHEV: 100+ km of EV range, petrol in reserve. BYD Song, Haval H6 GT and more.",
      intro:
        "Plug-in hybrids are flexible: daily commutes on electricity, longer trips on petrol. We import to order with warranty.",
    },
  },
  suv: {
    ru: {
      title: "Внедорожники и SUV из Китая в Ташкенте — Tez Motors",
      description:
        "SUV из Китая: BYD, Haval, Tank, Chery. Полный привод, простор, цены и характеристики.",
      intro:
        "Внедорожники из Китая нового поколения: уверенность в горах и мегаполисе, передовые системы помощи водителю, цены ниже японских аналогов.",
    },
    uz: {
      title: "Xitoydan SUV va off-roadlar — Tez Motors",
      description:
        "Xitoydan SUV: BYD, Haval, Tank, Chery. To'liq haydov, kenglik, narxlar va xususiyatlar.",
      intro:
        "Xitoyning yangi avlod SUV'lari — tog'da ham, shahar markazida ham ishonch. Yapon alternativlaridan arzonroq.",
    },
    en: {
      title: "SUVs from China in Tashkent — Tez Motors",
      description:
        "SUVs from China: BYD, Haval, Tank, Chery. AWD, space, prices and specs.",
      intro:
        "Next-gen Chinese SUVs deliver mountain confidence and city manners with advanced driver-assist tech, priced below Japanese rivals.",
    },
  },
  sedan: {
    ru: {
      title: "Седаны из Китая в Узбекистане — Tez Motors",
      description:
        "Седаны BYD, Geely, Chery — комфорт и расход. Импорт из Китая, прозрачные цены.",
      intro:
        "Современные китайские седаны — выгодная альтернатива классике: комфортная подвеска, мультимедиа последнего поколения, экономичные двигатели.",
    },
    uz: {
      title: "Xitoydan sedanlar — Tez Motors",
      description:
        "BYD, Geely, Chery sedanlari — qulaylik va tejamkorlik. Xitoydan import.",
      intro:
        "Zamonaviy xitoy sedanlari — klassikaga foydali muqobil: qulay osma, eng yangi multimedia, tejamli dvigatellar.",
    },
    en: {
      title: "Sedans from China — Tez Motors Uzbekistan",
      description:
        "BYD, Geely, Chery sedans — comfort and fuel economy. Direct import from China.",
      intro:
        "Modern Chinese sedans are a strong value alternative: comfortable suspension, latest-gen infotainment, efficient engines.",
    },
  },
  crossover: {
    ru: {
      title: "Кроссоверы из Китая — Tez Motors",
      description:
        "Кроссоверы Chery, Geely, Haval, BYD. Городской комфорт + лёгкое бездорожье.",
      intro:
        "Кроссовер сочетает удобство седана с дорожным просветом и универсальностью SUV. Лучший выбор для городской семьи.",
    },
    uz: {
      title: "Xitoydan krossoverlar — Tez Motors",
      description:
        "Chery, Geely, Haval, BYD krossoverlari. Shahar qulayligi va yengil bezdorozhe.",
      intro:
        "Krossover — sedanning qulayligini SUV'ning yo'l klirensi va universalligi bilan birlashtiradi. Shahar oilalari uchun eng yaxshi tanlov.",
    },
    en: {
      title: "Crossovers from China — Tez Motors",
      description:
        "Chery, Geely, Haval, BYD crossovers. City comfort plus light off-road ability.",
      intro:
        "Crossovers blend the comfort of a sedan with the ground clearance and versatility of an SUV — the best fit for city families.",
    },
  },
};

export function generateStaticParams() {
  return Object.keys(FILTER_MAP).map((filter) => ({ filter }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ filter: string }> },
): Promise<Metadata> {
  const { filter } = await params;
  if (!FILTER_MAP[filter]) return { title: "Not found" };

  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as SeoLocale | null) ??
    (getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value) as SeoLocale);

  const c = COPY[filter][locale];
  return {
    title: c.title,
    description: c.description,
    alternates: localizedAlternates(`/catalog/type/${filter}`, locale),
    openGraph: { title: c.title, description: c.description },
  };
}

export default async function FilterPage(
  { params }: { params: Promise<{ filter: string }> },
) {
  const { filter } = await params;
  const filters = FILTER_MAP[filter];
  if (!filters) notFound();

  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as SeoLocale | null) ??
    (getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value) as SeoLocale);

  const c = COPY[filter][locale];

  return (
    <>
      <BreadcrumbSchema
        items={[
          {
            name: locale === "ru" ? "Главная" : locale === "uz" ? "Bosh sahifa" : "Home",
            url: `${SITE_CONFIG.url}/${locale}`,
          },
          {
            name: locale === "ru" ? "Каталог" : locale === "uz" ? "Katalog" : "Catalog",
            url: `${SITE_CONFIG.url}/${locale}/catalog`,
          },
          {
            name: c.title.split("—")[0].trim(),
            url: `${SITE_CONFIG.url}/${locale}/catalog/type/${filter}`,
          },
        ]}
      />
      <div className="pt-24">
        <div className="container-custom">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gradient">
            {c.title}
          </h1>
          <p className="mt-4 text-base md:text-lg text-white/70 max-w-3xl">
            {c.intro}
          </p>
        </div>
      </div>
      <CatalogContent
        initialFilters={filters}
        basePath={`/catalog/type/${filter}`}
      />
    </>
  );
}
