import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { SITE_CONFIG } from "@/lib/constants";
import { getLocaleFromCookie } from "@/i18n/config";
import { PART_CATEGORIES } from "@/lib/schemas/part";
import PartsCatalogContent from "../../_content";

/**
 * Per-category landing page. Exists separately from `/parts?category=X`
 * so each category has its own canonical URL, <title>, and OG metadata —
 * dealer gets organic traffic for "запчасти двигателя BYD" etc.
 */

const COPY = {
  engine: {
    ru: {
      title: "Запчасти двигателя для китайских авто — BYD, Chery, Haval",
      description:
        "Фильтры, ремни, свечи, насосы и сенсоры двигателя для BYD, Chery, Haval, GWM и других китайских моделей. OEM и аналоги в наличии в Ташкенте.",
      heading: "Запчасти двигателя",
      sub: "OEM и аналоги — фильтры, ремни, насосы, сенсоры",
    },
    uz: {
      title: "Xitoy avtomobillari uchun dvigatel ehtiyot qismlari",
      description:
        "BYD, Chery, Haval va boshqa xitoy avtomobillari uchun dvigatel filtrlari, kamarlari, nasoslar va sensorlar. Toshkentda mavjud.",
      heading: "Dvigatel ehtiyot qismlari",
      sub: "OEM va analoglar — filtrlar, kamarlar, nasoslar, sensorlar",
    },
    en: {
      title: "Engine Parts for Chinese Cars — BYD, Chery, Haval",
      description:
        "Engine filters, belts, pumps, and sensors for BYD, Chery, Haval, GWM. OEM and aftermarket in stock in Tashkent.",
      heading: "Engine parts",
      sub: "OEM and aftermarket — filters, belts, pumps, sensors",
    },
  },
  body: {
    ru: {
      title: "Кузовные запчасти для китайских авто — бамперы, крылья, фары",
      description:
        "Бамперы, крылья, фары, капоты и зеркала для BYD, Chery, Haval, GWM, Geely. Оригинал и аналоги.",
      heading: "Кузовные запчасти",
      sub: "Бамперы, фары, крылья, зеркала",
    },
    uz: {
      title: "Xitoy avtomobillari uchun kuzov qismlari",
      description:
        "BYD, Chery, Haval uchun bamper, qanot, faralar va kaput. Asl va analog.",
      heading: "Kuzov qismlari",
      sub: "Bamperlar, faralar, qanotlar, oynalar",
    },
    en: {
      title: "Body Parts for Chinese Cars — bumpers, fenders, headlights",
      description:
        "Bumpers, fenders, headlights, hoods, mirrors for BYD, Chery, Haval, GWM, Geely. OEM and aftermarket.",
      heading: "Body parts",
      sub: "Bumpers, headlights, fenders, mirrors",
    },
  },
  electrical: {
    ru: {
      title: "Электрика для китайских авто — генераторы, стартеры, датчики",
      description:
        "Генераторы, стартеры, датчики, реле и электроника для BYD, Chery, Haval, BAIC.",
      heading: "Электрика",
      sub: "Генераторы, стартеры, датчики, реле",
    },
    uz: {
      title: "Xitoy avtomobillari uchun elektrika",
      description: "Generator, starter, datchiklar va elektronika.",
      heading: "Elektrika",
      sub: "Generatorlar, starterlar, datchiklar",
    },
    en: {
      title: "Electrical Parts for Chinese Cars — alternators, starters, sensors",
      description:
        "Alternators, starters, sensors, relays, and electronics for BYD, Chery, Haval, BAIC.",
      heading: "Electrical parts",
      sub: "Alternators, starters, sensors, relays",
    },
  },
  suspension: {
    ru: {
      title: "Подвеска для китайских авто — амортизаторы, сайлентблоки, рычаги",
      description:
        "Амортизаторы, пружины, сайлентблоки, рычаги и ступицы для BYD, Chery, Haval.",
      heading: "Подвеска",
      sub: "Амортизаторы, рычаги, сайлентблоки, ступицы",
    },
    uz: {
      title: "Xitoy avtomobillari uchun osma qismlari",
      description: "Amortizatorlar, prujinalar, richaglar, stupitsalar.",
      heading: "Osma qismlari",
      sub: "Amortizatorlar, richaglar, stupitsalar",
    },
    en: {
      title: "Suspension Parts for Chinese Cars — shocks, bushings, arms",
      description: "Shocks, springs, bushings, control arms, hubs.",
      heading: "Suspension",
      sub: "Shocks, arms, bushings, hubs",
    },
  },
  brakes: {
    ru: {
      title: "Тормоза для китайских авто — колодки, диски, суппорты",
      description:
        "Тормозные колодки, диски, суппорты и жидкости для BYD, Chery, Haval.",
      heading: "Тормоза",
      sub: "Колодки, диски, суппорты, жидкости",
    },
    uz: {
      title: "Xitoy avtomobillari uchun tormoz qismlari",
      description: "Tormoz kolodkalari, disklar, supportlar va suyuqliklar.",
      heading: "Tormozlar",
      sub: "Kolodkalar, disklar, supportlar",
    },
    en: {
      title: "Brake Parts for Chinese Cars — pads, discs, calipers",
      description: "Brake pads, discs, calipers, and fluids.",
      heading: "Brakes",
      sub: "Pads, discs, calipers, fluids",
    },
  },
  interior: {
    ru: {
      title: "Салон для китайских авто — коврики, чехлы, аксессуары",
      description:
        "Коврики, чехлы, накладки, аксессуары для салона BYD, Chery, Haval.",
      heading: "Салон",
      sub: "Коврики, чехлы, аксессуары",
    },
    uz: {
      title: "Xitoy avtomobillari uchun salon aksessuarlari",
      description: "Gilamlar, chexollar va salon aksessuarlari.",
      heading: "Salon",
      sub: "Gilamlar, chexollar, aksessuarlar",
    },
    en: {
      title: "Interior Accessories for Chinese Cars — mats, covers",
      description: "Floor mats, seat covers, trim, and interior accessories.",
      heading: "Interior",
      sub: "Mats, covers, trim",
    },
  },
  other: {
    ru: {
      title: "Прочие запчасти для китайских авто",
      description: "Расходники, фильтры, масла и прочие запчасти.",
      heading: "Прочее",
      sub: "Всё остальное — расходники, масла, мелочи",
    },
    uz: {
      title: "Boshqa ehtiyot qismlar",
      description: "Sarflanadigan materiallar, moylar va boshqa qismlar.",
      heading: "Boshqa",
      sub: "Sarflanadigan materiallar, moylar",
    },
    en: {
      title: "Other Spare Parts for Chinese Cars",
      description: "Consumables, oils, filters, and other parts.",
      heading: "Other",
      sub: "Consumables, oils, miscellany",
    },
  },
} as const;

type Category = (typeof PART_CATEGORIES)[number];

function isCategory(v: string): v is Category {
  return (PART_CATEGORIES as readonly string[]).includes(v);
}

export function generateStaticParams() {
  return PART_CATEGORIES.map((category) => ({ category }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ category: string }> },
): Promise<Metadata> {
  const { category } = await params;
  if (!isCategory(category)) return { title: "Not found" };

  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as "ru" | "uz" | "en" | null) ??
    getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value);

  const c = COPY[category][locale] ?? COPY[category].ru;

  return {
    title: c.title,
    description: c.description,
    alternates: {
      canonical: `${SITE_CONFIG.url}/${locale}/parts/category/${category}`,
      languages: {
        ru: `${SITE_CONFIG.url}/ru/parts/category/${category}`,
        uz: `${SITE_CONFIG.url}/uz/parts/category/${category}`,
        en: `${SITE_CONFIG.url}/en/parts/category/${category}`,
      },
    },
    openGraph: { title: c.title, description: c.description },
  };
}

export default async function PartsCategoryPage(
  { params }: { params: Promise<{ category: string }> },
) {
  const { category } = await params;
  if (!isCategory(category)) notFound();

  return (
    <Suspense fallback={null}>
      <PartsCatalogContent initialCategory={category} />
    </Suspense>
  );
}
