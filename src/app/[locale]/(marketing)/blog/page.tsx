import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocaleFromCookie } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { SectionHeading } from "@/components/shared/section-heading";
import { BlogList } from "./blog-list";
import type { BlogPost } from "@/types/car";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ category?: string }> }): Promise<Metadata> {
  const { category } = await searchParams;
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as "ru" | "uz" | "en" | null) ??
    getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value);

  const titleMap = {
    all: {
      ru: "Блог Tez Motors — Экспертная аналитика и ИИ",
      uz: "Tez Motors blogi — Ekspert tahlili va AI",
      en: "Tez Motors Blog — Expert Insights & AI",
    },
    ai: {
      ru: "ИИ и технологии в автоимпорте — Блог Tez Motors",
      uz: "AI va avto import texnologiyalari — Tez Motors blogi",
      en: "AI & Automotive Import Technology — Tez Motors Blog",
    },
    guides: {
      ru: "Инструкции и руководства по импорту авто — Блог Tez Motors",
      uz: "Avto import qilish bo'yicha yo'riqnomalar — Tez Motors blogi",
      en: "Car Sourcing & Import Guides — Tez Motors Blog",
    },
    analytics: {
      ru: "Аналитика авторынка Китая и Узбекистана — Блог Tez Motors",
      uz: "Xitoy va O'zbekiston avto bozori tahlili — Tez Motors blogi",
      en: "China & Uzbekistan Auto Market Analytics — Tez Motors Blog",
    },
  };

  const descMap = {
    all: {
      ru: "Ваш главный источник знаний об авторынке Китая, ИИ-импорте, таможенном оформлении и эксплуатации электромобилей в Узбекистане.",
      uz: "Xitoy avtomobil bozori, AI importi, bojxona rasmiylashtiruvi va O'zbekistonda elektromobillar ekspluatatsiyasi bo'yicha asosiy bilim manbangiz.",
      en: "Your primary knowledge source on the Chinese car market, AI import, customs clearance, and EV operations in Uzbekistan.",
    },
    ai: {
      ru: "Как искусственный интеллект меняет подбор и доставку автомобилей из Китая. Разборы технологий и кейсы от экспертов Tez Motors.",
      uz: "Sun'iy intellekt Xitoydan avtomobillarni tanlash va yetkazib berishni qanday o'zgartirayotgani. Tez Motors ekspertlaridan texnologiyalar tahlili.",
      en: "How artificial intelligence changes sourcing and shipping of cars from China. Tech breakdowns and case studies by Tez Motors.",
    },
    guides: {
      ru: "Подробные пошаговые руководства по растаможке, оформлению документов, проверке состояния и доставке автомобилей из Китая в Узбекистан.",
      uz: "Xitoydan O'zbekistonga avtomobillarni bojxona rasmiylashtiruvi, hujjatlarni tayyorlash va yetkazib berish bo'yicha batafsil bosqichma-boshqich qo'llanmalar.",
      en: "Detailed step-by-step guides on customs clearance, documentation, inspection, and shipping of cars from China to Uzbekistan.",
    },
    analytics: {
      ru: "Цены, тренды, статистика и прогнозы рынка электромобилей и гибридов в Узбекистане. Экспертные обзоры от аналитиков Tez Motors.",
      uz: "O'zbekistonda elektromobillar va gibridlar bozori narxlari, tendentsiyalari va prognozlari. Tez Motors tahlilchilaridan ekspert sharhlari.",
      en: "Prices, trends, statistics, and forecasts of the EV and hybrid market in Uzbekistan. Expert reviews by Tez Motors analysts.",
    },
  };

  const key = (category && titleMap[category as keyof typeof titleMap] ? category : "all") as keyof typeof titleMap;
  const title = titleMap[key][locale] || titleMap[key].ru;
  const description = descMap[key][locale] || descMap[key].ru;

  const canonicalUrl = category
    ? `https://tezmotors.uz/${locale}/blog?category=${category}`
    : `https://tezmotors.uz/${locale}/blog`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        ru: category ? `https://tezmotors.uz/ru/blog?category=${category}` : "https://tezmotors.uz/ru/blog",
        uz: category ? `https://tezmotors.uz/uz/blog?category=${category}` : "https://tezmotors.uz/uz/blog",
        en: category ? `https://tezmotors.uz/en/blog?category=${category}` : "https://tezmotors.uz/en/blog",
      },
    },
  };
}

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as "ru" | "uz" | "en" | null) ??
    getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value);
  const dictionary = await getDictionary(locale);
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("posts")
    .select("*, author:blog_authors(*)")
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false });

  const items = (posts || []) as BlogPost[];

  const headings = {
    ru: { title: "Блог и Аналитика", subtitle: "Глубокая аналитика авторынка Китая, разборы технологий и инструкции по импорту." },
    uz: { title: "Blog va Tahlil", subtitle: "Xitoy avtomobil bozori, texnologiyalar tahlili va import bo'yicha batafsil yo'riqnomalar." },
    en: { title: "Blog & Insights", subtitle: "Deep analysis of the Chinese auto market, tech breakdowns, and import guides." }
  };
  const h = headings[locale] || headings.ru;

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading
          as="h1"
          title={h.title}
          subtitle={h.subtitle}
        />
        <BlogList posts={items} locale={locale} dictionary={dictionary} initialCategory={category} />
      </div>
    </div>
  );
}
