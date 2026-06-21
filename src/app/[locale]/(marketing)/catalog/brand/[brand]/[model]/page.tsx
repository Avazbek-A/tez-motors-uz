import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Calculator as CalcIcon } from "lucide-react";
import { SITE_CONFIG } from "@/lib/constants";
import { getLocaleFromCookie } from "@/i18n/config";
import { localizedAlternates, type SeoLocale } from "@/lib/seo/alternates";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getUsdUzsRate } from "@/lib/fx-rate";
import { PUBLIC_CAR_LIST_COLUMNS } from "@/lib/car-columns";
import { modelSlug, modelFromSlug, getModelsForBrand, getComparableModels, combinedModelSlug } from "@/lib/models";
import { computeCustomsUz, resolveVehicleKind, resolveVehicleAge } from "@/lib/customs-uz";
import { formatPrice } from "@/lib/utils";
import type { Car } from "@/types/car";
import { CarCard } from "@/components/catalog/car-card";
import { BreadcrumbSchema } from "@/components/shared/breadcrumb-schema";
import { ItemListSchema } from "@/components/shared/structured-data";

/**
 * Per-model landing page: /catalog/brand/[brand]/[model].
 *
 * Server-rendered (full content + listings + schema in the HTML) so it's
 * Yandex-indexable and crawlers discover every car detail page from here. Targets
 * the long-tail "<Brand> <Model> цена/Узбекистан" cluster, shows a под-ключ landed
 * cost computed from the customs engine on the cheapest listing, and cross-links to
 * the calculator, the brand page, and sibling models. Fully dynamic (no
 * generateStaticParams — same reason as the brand page: it 404s under [locale]).
 */

async function fetchModelCars(brand: string, model: string): Promise<Car[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("cars")
      .select(PUBLIC_CAR_LIST_COLUMNS)
      .eq("brand", brand)
      .eq("model", model)
      .neq("inventory_status", "sold")
      .order("price_usd", { ascending: true });
    return (data as unknown as Car[]) || [];
  } catch {
    return [];
  }
}

function resolveLocale(h: Headers, cookieValue: string | undefined): SeoLocale {
  return (h.get("x-tez-locale") as SeoLocale | null) ?? (getLocaleFromCookie(cookieValue) as SeoLocale);
}

export async function generateMetadata(
  { params }: { params: Promise<{ brand: string; model: string }> },
): Promise<Metadata> {
  const { brand: bSlug, model: mSlug } = await params;
  const m = await modelFromSlug(bSlug, mSlug);
  if (!m) return { title: "Not found" };

  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale = resolveLocale(requestHeaders, cookieStore.get("NEXT_LOCALE")?.value);
  const name = `${m.brand} ${m.model}`;

  const copy = {
    ru: {
      title: `${name} — цена в Узбекистане 2026`,
      description: `Купить ${name} в Узбекистане под ключ: импорт из Китая, растаможка, доставка, гарантия. ${m.count} в наличии. Прозрачные цены — Tez Motors.`,
    },
    uz: {
      title: `${name} — O'zbekistonda narxi 2026`,
      description: `${name} ni O'zbekistonda sotib oling: Xitoydan import, rastamojka, yetkazib berish, kafolat. ${m.count} ta mavjud. Tez Motors.`,
    },
    en: {
      title: `${name} — price in Uzbekistan 2026`,
      description: `Buy ${name} in Uzbekistan turn-key: import from China, customs, delivery, warranty. ${m.count} in stock. Tez Motors.`,
    },
  }[locale];

  return {
    title: copy.title,
    description: copy.description,
    alternates: localizedAlternates(`/catalog/brand/${bSlug}/${mSlug}`, locale),
    openGraph: { title: copy.title, description: copy.description },
  };
}

export default async function ModelPage(
  { params }: { params: Promise<{ brand: string; model: string }> },
) {
  const { brand: bSlug, model: mSlug } = await params;
  const m = await modelFromSlug(bSlug, mSlug);
  if (!m) notFound();

  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale = resolveLocale(requestHeaders, cookieStore.get("NEXT_LOCALE")?.value);

  const [cars, siblings, comparables] = await Promise.all([
    fetchModelCars(m.brand, m.model),
    getModelsForBrand(m.brand),
    getComparableModels(m),
  ]);

  // под-ключ landed cost from the cheapest real-priced listing, via the customs engine.
  let landedFrom: number | null = null;
  const rep = cars.find((c) => c.price_usd > 0);
  if (rep) {
    let usdUzs: number | undefined;
    try {
      usdUzs = await getUsdUzsRate(createServiceClient());
    } catch {
      /* engine falls back to DEFAULT_USD_UZS */
    }
    landedFrom = computeCustomsUz({
      priceUsd: rep.price_usd,
      kind: resolveVehicleKind(rep.fuel_type),
      age: resolveVehicleAge(rep.year),
      engineCc: rep.engine_volume ? Math.round(rep.engine_volume * 1000) : 0,
      usdUzs,
    }).totalUsd;
  }

  const name = `${m.brand} ${m.model}`;
  const t = {
    ru: {
      h1: `${name} в Узбекистане`,
      intro: `Купить ${name} под ключ: импорт напрямую из Китая, растаможка, доставка по Узбекистану и гарантия. Актуальные цены и комплектации в наличии.`,
      inStock: `${cars.length} в наличии`,
      from: "Под ключ от",
      fromNote: "включая растаможку",
      calcCta: "Точный расчёт растаможки",
      empty: `Сейчас ${name} нет в наличии — оставьте заявку, и мы привезём под заказ.`,
      order: "Заказать под заказ",
      others: `Другие модели ${m.brand}`,
      allBrand: `Весь модельный ряд ${m.brand}`,
    },
    uz: {
      h1: `${name} O'zbekistonda`,
      intro: `${name} ni to'liq xizmat bilan sotib oling: Xitoydan to'g'ridan-to'g'ri import, rastamojka, O'zbekiston bo'ylab yetkazib berish va kafolat.`,
      inStock: `${cars.length} ta mavjud`,
      from: "Под ключ —",
      fromNote: "rastamojka bilan",
      calcCta: "Aniq rastamojka hisobi",
      empty: `Hozircha ${name} mavjud emas — ariza qoldiring, buyurtma asosida olib kelamiz.`,
      order: "Buyurtma berish",
      others: `${m.brand} ning boshqa modellari`,
      allBrand: `Barcha ${m.brand} modellari`,
    },
    en: {
      h1: `${name} in Uzbekistan`,
      intro: `Buy ${name} turn-key: direct import from China, customs clearance, delivery across Uzbekistan and warranty. Live prices and trims in stock.`,
      inStock: `${cars.length} in stock`,
      from: "Turn-key from",
      fromNote: "customs included",
      calcCta: "Exact customs estimate",
      empty: `${name} is not in stock right now — leave a request and we'll import it to order.`,
      order: "Order to import",
      others: `Other ${m.brand} models`,
      allBrand: `All ${m.brand} models`,
    },
  }[locale];

  const itemListItems = cars.slice(0, 30).map((c) => ({
    name: `${c.brand} ${c.model} ${c.year}`,
    url: `${SITE_CONFIG.url}/${locale}/catalog/${c.slug}`,
  }));

  const otherModels = siblings.filter((s) => s.model !== m.model).slice(0, 12);

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: locale === "ru" ? "Главная" : locale === "uz" ? "Bosh sahifa" : "Home", url: `${SITE_CONFIG.url}/${locale}` },
          { name: locale === "ru" ? "Каталог" : locale === "uz" ? "Katalog" : "Catalog", url: `${SITE_CONFIG.url}/${locale}/catalog` },
          { name: m.brand, url: `${SITE_CONFIG.url}/${locale}/catalog/brand/${bSlug}` },
          { name: name, url: `${SITE_CONFIG.url}/${locale}/catalog/brand/${bSlug}/${mSlug}` },
        ]}
      />
      <ItemListSchema items={itemListItems} />

      <div className="pt-24 pb-16">
        <div className="container-custom space-y-10">
          {/* Header */}
          <div className="space-y-4">
            <nav className="text-sm text-muted-foreground">
              <Link href={`/${locale}/catalog/brand/${bSlug}`} className="hover:text-foreground">
                {m.brand}
              </Link>
              <span className="mx-1.5">/</span>
              <span className="text-foreground">{m.model}</span>
            </nav>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">{t.h1}</h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-3xl">{t.intro}</p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <span className="rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-foreground">
                {t.inStock}
              </span>
              {landedFrom !== null && (
                <span className="rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm font-medium text-foreground">
                  {t.from} <strong className="text-primary">{formatPrice(landedFrom)}</strong>
                  <span className="text-muted-foreground"> · {t.fromNote}</span>
                </span>
              )}
              <Link
                href={`/${locale}/calculator`}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <CalcIcon className="w-4 h-4" />
                {t.calcCta}
              </Link>
            </div>
          </div>

          {/* Listings */}
          {cars.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {cars.map((car) => (
                <CarCard key={car.id} car={car} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center space-y-4">
              <p className="text-muted-foreground">{t.empty}</p>
              <Link
                href={`/${locale}/order`}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {t.order}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* Sibling models — internal linking */}
          {otherModels.length > 0 && (
            <div className="space-y-3 border-t border-border pt-8">
              <h2 className="text-lg font-bold text-foreground">{t.others}</h2>
              <div className="flex flex-wrap gap-2">
                {otherModels.map((s) => (
                  <Link
                    key={s.model}
                    href={`/${locale}/catalog/brand/${bSlug}/${modelSlug(s.model)}`}
                    className="rounded-full border border-border bg-card px-4 py-1.5 text-sm text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {s.model}
                  </Link>
                ))}
                <Link
                  href={`/${locale}/catalog/brand/${bSlug}`}
                  className="rounded-full border border-border bg-muted/40 px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
                >
                  {t.allBrand} →
                </Link>
              </div>
            </div>
          )}

          {comparables.length > 0 && (
            <div className="space-y-3 border-t border-border pt-8">
              <h2 className="text-lg font-bold text-foreground">
                {locale === "ru" ? "Сравнить с конкурентами" : locale === "uz" ? "Raqobatchilar bilan solishtirish" : "Compare with rivals"}
              </h2>
              <div className="flex flex-wrap gap-2">
                {comparables.map((comp) => (
                  <Link
                    key={`${comp.brand}-${comp.model}`}
                    href={`/${locale}/compare/models/${combinedModelSlug(m)}-vs-${combinedModelSlug(comp)}`}
                    className="rounded-full border border-border bg-card px-4 py-1.5 text-sm text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {m.model} vs {comp.brand} {comp.model}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
