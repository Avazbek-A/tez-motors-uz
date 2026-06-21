import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Calculator as CalcIcon, Search, ShieldCheck, CreditCard, Ship, FileCheck, KeyRound } from "lucide-react";
import { SITE_CONFIG } from "@/lib/constants";
import { getLocaleFromCookie } from "@/i18n/config";
import { localizedAlternates, type SeoLocale } from "@/lib/seo/alternates";
import { BreadcrumbSchema } from "@/components/shared/breadcrumb-schema";
import { FAQSchema } from "@/components/shared/structured-data";

/**
 * Source-country import hubs: /import/[country] for china | korea | usa | germany.
 *
 * Captures the "пригнать / авто из <страна> в Узбекистан" cluster (informational →
 * transactional). Server-rendered, trilingual. A shared import process + an
 * eligibility note (7yr/Euro-5/RHD) is reused across countries; each country adds
 * its own angle, timeline and FAQ. China leads to the catalog (we stock it);
 * the rest lead to "под заказ". Fully dynamic (no generateStaticParams under
 * [locale]); unknown country → notFound.
 */

type L = "ru" | "uz" | "en";

const COUNTRY_SLUGS = ["china", "korea", "usa", "germany"] as const;
type CountrySlug = (typeof COUNTRY_SLUGS)[number];

const isCountry = (v: string): v is CountrySlug => (COUNTRY_SLUGS as readonly string[]).includes(v);

const STEP_ICONS = [Search, ShieldCheck, CreditCard, Ship, FileCheck, KeyRound];

// Shared, country-agnostic import process.
const PROCESS: Record<L, { title: string; steps: { h: string; d: string }[] }> = {
  ru: {
    title: "Как мы привозим авто под ключ",
    steps: [
      { h: "Подбор", d: "Выбираете из каталога или присылаете желаемую модель — подбираем варианты по бюджету." },
      { h: "Проверка", d: "Проверяем историю, состояние и комплектацию до оплаты." },
      { h: "Оплата и договор", d: "Прозрачный договор, фиксируем цену и сроки." },
      { h: "Доставка", d: "Организуем логистику до Узбекистана." },
      { h: "Растаможка", d: "Оформляем таможню, пошлины, НДС и утильсбор." },
      { h: "Передача", d: "Помогаем с регистрацией и передаём вам ключи." },
    ],
  },
  uz: {
    title: "Avtoni to'liq xizmat bilan qanday olib kelamiz",
    steps: [
      { h: "Tanlash", d: "Katalogdan tanlaysiz yoki kerakli modelni yuborasiz — byudjetga moslab tanlaymiz." },
      { h: "Tekshiruv", d: "To'lovdan oldin tarix, holat va komplektatsiyani tekshiramiz." },
      { h: "To'lov va shartnoma", d: "Shaffof shartnoma, narx va muddatlarni belgilaymiz." },
      { h: "Yetkazib berish", d: "O'zbekistongacha logistikani tashkil qilamiz." },
      { h: "Rastamojka", d: "Bojxona, boj, QQS va utilizatsiya yig'imini rasmiylashtiramiz." },
      { h: "Topshirish", d: "Ro'yxatdan o'tkazishda yordam beramiz va kalitni beramiz." },
    ],
  },
  en: {
    title: "How we import a car turn-key",
    steps: [
      { h: "Sourcing", d: "Pick from the catalog or send us the model you want — we source options to budget." },
      { h: "Inspection", d: "We verify history, condition and spec before any payment." },
      { h: "Payment & contract", d: "Transparent contract, fixed price and timeline." },
      { h: "Shipping", d: "We arrange the logistics to Uzbekistan." },
      { h: "Customs", d: "We handle clearance — duty, VAT and the recycling fee." },
      { h: "Handover", d: "We help with registration and hand you the keys." },
    ],
  },
};

const ELIGIBILITY: Record<L, string> = {
  ru: "Для авто с ДВС действуют требования ввоза: не старше 7 лет и эко-класс не ниже Евро-5; праворульные — запрещены. Электромобили — без ограничений по возрасту и эко-классу.",
  uz: "ICE avtolar uchun import talablari: 7 yildan oshmagan va Yevro-5 dan past bo'lmagan; o'ng rulli — taqiqlangan. Elektromobillar — yosh va eko-sinf bo'yicha cheklovsiz.",
  en: "ICE cars must meet import rules: no older than 7 years and at least Euro-5; right-hand-drive is banned. Electric vehicles have no age or emission limit.",
};

interface CountryCopy {
  name: string; // genitive-ready country name used in headings
  h1: string;
  intro: string;
  whyTitle: string;
  why: string[];
  timelineLabel: string;
  timeline: string;
  faq: { q: string; a: string }[];
}

const COUNTRIES: Record<CountrySlug, { primary: "catalog" | "order"; copy: Record<L, CountryCopy> }> = {
  china: {
    primary: "catalog",
    copy: {
      ru: {
        name: "Китая",
        h1: "Авто из Китая в Узбекистан под ключ",
        intro: "Импортируем новые автомобили напрямую с заводов и площадок Китая: подбор, доставка, растаможка и гарантия. Электромобили, гибриды и кроссоверы по прозрачным ценам.",
        whyTitle: "Почему авто из Китая",
        why: ["Новейшие электро и гибриды", "Лучшие цены напрямую с завода", "Огромный выбор: BYD, Zeekr, Li Auto, Changan, Haval, Chery", "Быстрые сроки доставки"],
        timelineLabel: "Срок",
        timeline: "обычно 3–6 недель",
        faq: [
          { q: "Сколько стоит авто из Китая под ключ?", a: "Итоговая цена — это стоимость авто плюс доставка и растаможка (пошлина, НДС 12%, утильсбор). Рассчитайте на калькуляторе; электромобили освобождены от пошлины." },
          { q: "Новые или подержанные авто из Китая?", a: "В основном новые — напрямую с завода. Под заказ возможны и автомобили с пробегом." },
          { q: "Какие бренды можно привезти?", a: "BYD, Zeekr, Li Auto, Changan, Haval, Chery, Geely, Tank, Omoda, Jaecoo и другие." },
        ],
      },
      uz: {
        name: "Xitoydan",
        h1: "Xitoydan O'zbekistonga avto — to'liq xizmat",
        intro: "Xitoy zavodlaridan to'g'ridan-to'g'ri yangi avtomobillarni import qilamiz: tanlash, yetkazib berish, rastamojka va kafolat. Elektromobil, gibrid va krossoverlar shaffof narxlarda.",
        whyTitle: "Nega Xitoydan avto",
        why: ["Eng yangi elektro va gibridlar", "Zavoddan to'g'ridan-to'g'ri eng yaxshi narx", "Katta tanlov: BYD, Zeekr, Li Auto, Changan, Haval, Chery", "Tez yetkazib berish"],
        timelineLabel: "Muddat",
        timeline: "odatda 3–6 hafta",
        faq: [
          { q: "Xitoydan avto to'liq xizmat bilan qancha turadi?", a: "Yakuniy narx — avto narxi + yetkazib berish va rastamojka (boj, 12% QQS, utilizatsiya). Kalkulyatorda hisoblang; elektromobillar bojdan ozod." },
          { q: "Yangi yoki ishlatilgan?", a: "Asosan yangi — zavoddan to'g'ridan-to'g'ri. Buyurtma asosida probegli avtolar ham mumkin." },
          { q: "Qaysi brendlarni olib kelish mumkin?", a: "BYD, Zeekr, Li Auto, Changan, Haval, Chery, Geely, Tank, Omoda, Jaecoo va boshqalar." },
        ],
      },
      en: {
        name: "China",
        h1: "Cars from China to Uzbekistan — turn-key",
        intro: "We import new cars directly from China's factories and lots: sourcing, delivery, customs and warranty. EVs, hybrids and crossovers at transparent prices.",
        whyTitle: "Why import from China",
        why: ["The newest EVs and hybrids", "Best prices, factory-direct", "Huge choice: BYD, Zeekr, Li Auto, Changan, Haval, Chery", "Fast delivery times"],
        timelineLabel: "Timeline",
        timeline: "typically 3–6 weeks",
        faq: [
          { q: "How much does a car from China cost turn-key?", a: "The final price is the car plus shipping and customs (duty, 12% VAT, recycling fee). Use the calculator; EVs are duty-exempt." },
          { q: "New or used cars from China?", a: "Mostly new — factory-direct. Used cars are possible to order." },
          { q: "Which brands can you bring?", a: "BYD, Zeekr, Li Auto, Changan, Haval, Chery, Geely, Tank, Omoda, Jaecoo and more." },
        ],
      },
    },
  },
  korea: {
    primary: "order",
    copy: {
      ru: {
        name: "Кореи",
        h1: "Авто из Кореи в Узбекистан под ключ",
        intro: "Привозим автомобили из Южной Кореи под заказ: подбор по вашему запросу, проверка истории, доставка и растаможка. Hyundai, Kia, Genesis и другие.",
        whyTitle: "Почему авто из Кореи",
        why: ["Ухоженные авто с прозрачной историей", "Hyundai, Kia, Genesis, SsangYong", "Хорошее соотношение цена/состояние", "Полная проверка перед покупкой"],
        timelineLabel: "Срок",
        timeline: "обычно 4–8 недель",
        faq: [
          { q: "Можно ли пригнать авто из Кореи в Узбекистан?", a: "Да, под заказ. Для авто с ДВС действует лимит 7 лет и Евро-5; электромобили без ограничений по возрасту." },
          { q: "Сколько стоит растаможка авто из Кореи?", a: "Зависит от объёма двигателя и возраста. Рассчитайте точную сумму на калькуляторе растаможки." },
        ],
      },
      uz: {
        name: "Koreyadan",
        h1: "Koreyadan O'zbekistonga avto — to'liq xizmat",
        intro: "Janubiy Koreyadan avtomobillarni buyurtma asosida olib kelamiz: so'rovingiz bo'yicha tanlash, tarix tekshiruvi, yetkazib berish va rastamojka. Hyundai, Kia, Genesis va boshqalar.",
        whyTitle: "Nega Koreyadan avto",
        why: ["Tarixi shaffof, ozoda avtolar", "Hyundai, Kia, Genesis, SsangYong", "Narx/holat nisbati yaxshi", "Sotib olishdan oldin to'liq tekshiruv"],
        timelineLabel: "Muddat",
        timeline: "odatda 4–8 hafta",
        faq: [
          { q: "Koreyadan O'zbekistonga avto olib kelish mumkinmi?", a: "Ha, buyurtma asosida. ICE avtolar uchun 7 yil va Yevro-5 limiti; elektromobillar yoshi bo'yicha cheklovsiz." },
          { q: "Koreyadan avto rastamojkasi qancha?", a: "Dvigatel hajmi va yoshga bog'liq. Aniq summani rastamojka kalkulyatorida hisoblang." },
        ],
      },
      en: {
        name: "Korea",
        h1: "Cars from Korea to Uzbekistan — turn-key",
        intro: "We import cars from South Korea to order: sourcing to your request, history checks, delivery and customs. Hyundai, Kia, Genesis and more.",
        whyTitle: "Why import from Korea",
        why: ["Well-kept cars with clear history", "Hyundai, Kia, Genesis, SsangYong", "Great price-to-condition value", "Full pre-purchase inspection"],
        timelineLabel: "Timeline",
        timeline: "typically 4–8 weeks",
        faq: [
          { q: "Can you import a car from Korea to Uzbekistan?", a: "Yes, to order. ICE cars face the 7-year and Euro-5 limits; EVs have no age limit." },
          { q: "How much is customs on a car from Korea?", a: "It depends on engine size and age. Use the customs calculator for an exact figure." },
        ],
      },
    },
  },
  usa: {
    primary: "order",
    copy: {
      ru: {
        name: "США",
        h1: "Авто из США (Америки) в Узбекистан под ключ",
        intro: "Привозим автомобили из США под заказ, в том числе с аукционов Copart и IAAI: подбор, проверка, доставка и растаможка. Внедорожники, пикапы, Tesla и не только.",
        whyTitle: "Почему авто из США",
        why: ["Внедорожники, пикапы и мускул-кары", "Tesla и другие электромобили", "Аукционы Copart / IAAI — выгодные цены", "Большой выбор комплектаций"],
        timelineLabel: "Срок",
        timeline: "обычно 8–12 недель",
        faq: [
          { q: "Можно ли пригнать авто из США в Узбекистан?", a: "Да, под заказ, включая аукционные авто. Для ДВС действует лимит 7 лет и Евро-5; электромобили без ограничений по возрасту." },
          { q: "Сколько идёт доставка из США?", a: "Обычно 8–12 недель с учётом морской логистики и оформления." },
        ],
      },
      uz: {
        name: "AQShdan",
        h1: "AQShdan (Amerikadan) O'zbekistonga avto — to'liq xizmat",
        intro: "AQShdan avtomobillarni buyurtma asosida, jumladan Copart va IAAI auksionlaridan olib kelamiz: tanlash, tekshiruv, yetkazib berish va rastamojka. Yo'l tanlamaslar, piklar, Tesla va boshqalar.",
        whyTitle: "Nega AQShdan avto",
        why: ["Yo'l tanlamaslar, piklar va muskul-karlar", "Tesla va boshqa elektromobillar", "Copart / IAAI auksionlari — foydali narx", "Komplektatsiyalar tanlovi katta"],
        timelineLabel: "Muddat",
        timeline: "odatda 8–12 hafta",
        faq: [
          { q: "AQShdan O'zbekistonga avto olib kelish mumkinmi?", a: "Ha, buyurtma asosida, auksion avtolari ham. ICE uchun 7 yil va Yevro-5 limiti; elektromobillar yoshi bo'yicha cheklovsiz." },
          { q: "AQShdan yetkazib berish qancha vaqt oladi?", a: "Odatda 8–12 hafta — dengiz logistikasi va rasmiylashtiruv bilan." },
        ],
      },
      en: {
        name: "the USA",
        h1: "Cars from the USA to Uzbekistan — turn-key",
        intro: "We import cars from the USA to order, including Copart and IAAI auctions: sourcing, inspection, delivery and customs. SUVs, pickups, Tesla and more.",
        whyTitle: "Why import from the USA",
        why: ["SUVs, pickups and muscle cars", "Tesla and other EVs", "Copart / IAAI auctions — great prices", "Wide choice of trims"],
        timelineLabel: "Timeline",
        timeline: "typically 8–12 weeks",
        faq: [
          { q: "Can you import a car from the USA to Uzbekistan?", a: "Yes, to order, including auction cars. ICE cars face the 7-year and Euro-5 limits; EVs have no age limit." },
          { q: "How long does shipping from the USA take?", a: "Typically 8–12 weeks including sea freight and clearance." },
        ],
      },
    },
  },
  germany: {
    primary: "order",
    copy: {
      ru: {
        name: "Германии",
        h1: "Авто из Германии в Узбекистан под ключ",
        intro: "Привозим премиальные автомобили из Германии под заказ: подбор, проверка истории, доставка и растаможка. BMW, Mercedes-Benz, Audi, Porsche, Volkswagen.",
        whyTitle: "Почему авто из Германии",
        why: ["Премиальные BMW, Mercedes, Audi, Porsche, VW", "Немецкое качество сборки", "Полная сервисная история", "Богатые комплектации"],
        timelineLabel: "Срок",
        timeline: "обычно 6–10 недель",
        faq: [
          { q: "Можно ли пригнать авто из Германии в Узбекистан?", a: "Да, под заказ. Для авто с ДВС — лимит 7 лет и Евро-5; электромобили без ограничений по возрасту." },
          { q: "Сколько стоит растаможка авто из Германии?", a: "Зависит от объёма двигателя и возраста. Точную сумму посчитает калькулятор растаможки." },
        ],
      },
      uz: {
        name: "Germaniyadan",
        h1: "Germaniyadan O'zbekistonga avto — to'liq xizmat",
        intro: "Germaniyadan premium avtomobillarni buyurtma asosida olib kelamiz: tanlash, tarix tekshiruvi, yetkazib berish va rastamojka. BMW, Mercedes-Benz, Audi, Porsche, Volkswagen.",
        whyTitle: "Nega Germaniyadan avto",
        why: ["Premium BMW, Mercedes, Audi, Porsche, VW", "Nemis yig'ish sifati", "To'liq servis tarixi", "Boy komplektatsiyalar"],
        timelineLabel: "Muddat",
        timeline: "odatda 6–10 hafta",
        faq: [
          { q: "Germaniyadan O'zbekistonga avto olib kelish mumkinmi?", a: "Ha, buyurtma asosida. ICE uchun 7 yil va Yevro-5 limiti; elektromobillar yoshi bo'yicha cheklovsiz." },
          { q: "Germaniyadan avto rastamojkasi qancha?", a: "Dvigatel hajmi va yoshga bog'liq. Aniq summani rastamojka kalkulyatori hisoblaydi." },
        ],
      },
      en: {
        name: "Germany",
        h1: "Cars from Germany to Uzbekistan — turn-key",
        intro: "We import premium cars from Germany to order: sourcing, history checks, delivery and customs. BMW, Mercedes-Benz, Audi, Porsche, Volkswagen.",
        whyTitle: "Why import from Germany",
        why: ["Premium BMW, Mercedes, Audi, Porsche, VW", "German build quality", "Full service history", "Rich equipment levels"],
        timelineLabel: "Timeline",
        timeline: "typically 6–10 weeks",
        faq: [
          { q: "Can you import a car from Germany to Uzbekistan?", a: "Yes, to order. ICE cars face the 7-year and Euro-5 limits; EVs have no age limit." },
          { q: "How much is customs on a car from Germany?", a: "It depends on engine size and age. The customs calculator gives an exact figure." },
        ],
      },
    },
  },
};

function resolveLocale(h: Headers, cookieValue: string | undefined): SeoLocale {
  return (h.get("x-tez-locale") as SeoLocale | null) ?? (getLocaleFromCookie(cookieValue) as SeoLocale);
}

export async function generateMetadata(
  { params }: { params: Promise<{ country: string }> },
): Promise<Metadata> {
  const { country } = await params;
  if (!isCountry(country)) return { title: "Not found" };
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale = resolveLocale(requestHeaders, cookieStore.get("NEXT_LOCALE")?.value);
  const c = COUNTRIES[country].copy[locale];
  return {
    title: c.h1,
    description: c.intro,
    alternates: localizedAlternates(`/import/${country}`, locale),
    openGraph: { title: c.h1, description: c.intro },
  };
}

export default async function ImportCountryPage(
  { params }: { params: Promise<{ country: string }> },
) {
  const { country } = await params;
  if (!isCountry(country)) notFound();

  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale = resolveLocale(requestHeaders, cookieStore.get("NEXT_LOCALE")?.value);

  const conf = COUNTRIES[country];
  const c = conf.copy[locale];
  const proc = PROCESS[locale];

  const tt = {
    ru: { browse: "Смотреть каталог", order: "Заказать под заказ", calc: "Рассчитать растаможку", rules: "Правила ввоза", faqH: "Частые вопросы" },
    uz: { browse: "Katalogni ko'rish", order: "Buyurtma berish", calc: "Rastamojkani hisoblash", rules: "Import qoidalari", faqH: "Tez-tez beriladigan savollar" },
    en: { browse: "Browse the catalog", order: "Order to import", calc: "Estimate customs", rules: "Import rules", faqH: "FAQ" },
  }[locale];

  const primaryHref = conf.primary === "catalog" ? `/${locale}/catalog` : `/${locale}/order`;
  const primaryLabel = conf.primary === "catalog" ? tt.browse : tt.order;

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: locale === "ru" ? "Главная" : locale === "uz" ? "Bosh sahifa" : "Home", url: `${SITE_CONFIG.url}/${locale}` },
          { name: c.h1, url: `${SITE_CONFIG.url}/${locale}/import/${country}` },
        ]}
      />
      <FAQSchema faqs={c.faq.map((f) => ({ question: f.q, answer: f.a }))} />

      <div className="pt-24 pb-16">
        <div className="container-custom max-w-4xl space-y-12">
          {/* Hero */}
          <header className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">{c.h1}</h1>
            <p className="text-base md:text-lg text-muted-foreground">{c.intro}</p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href={primaryHref}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {primaryLabel}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href={`/${locale}/calculator`}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/40"
              >
                <CalcIcon className="w-4 h-4" />
                {tt.calc}
              </Link>
              <span className="text-sm text-muted-foreground">
                {c.timelineLabel}: <strong className="text-foreground">{c.timeline}</strong>
              </span>
            </div>
          </header>

          {/* Why this country */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">{c.whyTitle}</h2>
            <ul className="grid sm:grid-cols-2 gap-2 text-sm text-foreground">
              {c.why.map((w, i) => (
                <li key={i} className="rounded-lg border border-border bg-card px-4 py-3">{w}</li>
              ))}
            </ul>
          </section>

          {/* Process */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">{proc.title}</h2>
            <ol className="grid sm:grid-cols-2 gap-4">
              {proc.steps.map((s, i) => {
                const Icon = STEP_ICONS[i] ?? Search;
                return (
                  <li key={i} className="flex gap-3 rounded-xl border border-border bg-card p-4">
                    <div className="shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{i + 1}. {s.h}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{s.d}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Eligibility */}
          <section className="rounded-xl border border-border bg-muted/30 p-5 space-y-1.5">
            <h2 className="text-base font-bold text-foreground">{tt.rules}</h2>
            <p className="text-sm text-muted-foreground">{ELIGIBILITY[locale]}</p>
            <Link href={`/${locale}/calculator`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              {tt.calc} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </section>

          {/* FAQ */}
          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-foreground">{tt.faqH}</h2>
            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {c.faq.map((f, i) => (
                <details key={i} className="group p-5">
                  <summary className="cursor-pointer list-none font-semibold text-foreground flex items-center justify-between gap-3">
                    {f.q}
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* Other countries — cluster cross-links so no hub is orphaned */}
          <section className="space-y-3 border-t border-border pt-8">
            <h2 className="text-lg font-bold text-foreground">
              {locale === "ru" ? "Импорт из других стран" : locale === "uz" ? "Boshqa davlatlardan import" : "Import from other countries"}
            </h2>
            <div className="flex flex-wrap gap-2">
              {COUNTRY_SLUGS.filter((s) => s !== country).map((s) => {
                const n = COUNTRIES[s].copy[locale].name;
                const label = locale === "ru" ? `Авто из ${n}` : locale === "uz" ? `${n} avto` : `Cars from ${n}`;
                return (
                  <Link
                    key={s}
                    href={`/${locale}/import/${s}`}
                    className="rounded-full border border-border bg-card px-4 py-1.5 text-sm text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
