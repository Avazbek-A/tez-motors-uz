import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { cookies, headers } from "next/headers";
import { SITE_CONFIG } from "@/lib/constants";
import { getLocaleFromCookie } from "@/i18n/config";
import { localizedAlternates, type SeoLocale } from "@/lib/seo/alternates";
import { localizedPath } from "@/lib/locale-path";
import { BreadcrumbSchema } from "@/components/shared/breadcrumb-schema";
import { TrustBar } from "@/components/shared/trust-bar";
import { createServiceClient } from "@/lib/supabase/service";

const COPY: Record<SeoLocale, { title: string; description: string; h1: string; intro: string; empty: string; cta: string }> = {
  ru: {
    title: "Доставленные авто — Tez Motors",
    description: "Реальные автомобили, которые Tez Motors привёз клиентам из Китая. Импорт «под ключ»: подбор, доставка, таможня, гарантия.",
    h1: "Мы уже доставили эти авто",
    intro: "Импорт из Китая вызывает один вопрос: «а машину действительно привезут?». Вот реальные автомобили, которые мы передали клиентам — каждый прошёл подбор, оплату, доставку, растаможку и выдачу.",
    empty: "Скоро здесь появятся доставленные автомобили.",
    cta: "Заказать свой автомобиль",
  },
  uz: {
    title: "Yetkazilgan avtolar — Tez Motors",
    description: "Tez Motors Xitoydan mijozlarga olib kelgan haqiqiy avtomobillar. «Kalit topshirish» importi: tanlov, yetkazib berish, bojxona, kafolat.",
    h1: "Biz allaqachon yetkazgan avtolar",
    intro: "Xitoydan import bitta savol tug'diradi: «avto rostdan ham keladimi?». Mana mijozlarga topshirgan haqiqiy avtomobillar — har biri tanlov, to'lov, yetkazib berish, bojxona va topshirishdan o'tgan.",
    empty: "Tez orada bu yerda yetkazilgan avtomobillar paydo bo'ladi.",
    cta: "O'z avtomobilingizni buyurtma qiling",
  },
  en: {
    title: "Delivered cars — Tez Motors",
    description: "Real cars Tez Motors imported from China for customers. Turn-key import: sourcing, delivery, customs, warranty.",
    h1: "Cars we've already delivered",
    intro: "Importing from China raises one question: \"will the car actually arrive?\" Here are real cars we handed to customers — each went through sourcing, payment, delivery, customs, and handover.",
    empty: "Delivered cars will appear here soon.",
    cta: "Order your car",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const ck = await cookies();
  const locale = ((h.get("x-tez-locale") as SeoLocale | null) ?? (getLocaleFromCookie(ck.get("NEXT_LOCALE")?.value) as SeoLocale)) || "ru";
  const c = COPY[locale];
  return {
    title: c.title,
    description: c.description,
    alternates: localizedAlternates("/delivered", locale),
    openGraph: { title: c.title, description: c.description },
  };
}

interface DeliveredCar {
  brand: string;
  model: string;
  year: number | null;
  slug: string;
  image: string | null;
  delivered_month: string;
  customer_initial: string;
}

async function fetchDelivered(): Promise<DeliveredCar[]> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("orders")
      .select("updated_at, customer_name, cars(brand, model, year, slug, thumbnail, images)")
      .eq("status", "delivered")
      .order("updated_at", { ascending: false })
      .limit(48);
    return ((data as unknown[]) || [])
      .map((row) => {
        const o = row as { updated_at: string; customer_name: string | null; cars: unknown };
        const rel = o.cars as { brand: string; model: string; year: number | null; slug: string; thumbnail: string | null; images: string[] | null } | { brand: string; model: string; year: number | null; slug: string; thumbnail: string | null; images: string[] | null }[] | null;
        const car = Array.isArray(rel) ? rel[0] : rel;
        if (!car) return null;
        const name = (o.customer_name || "").trim();
        return {
          brand: car.brand,
          model: car.model,
          year: car.year,
          slug: car.slug,
          image: car.thumbnail || (Array.isArray(car.images) ? car.images[0] : null),
          delivered_month: (o.updated_at || "").slice(0, 7),
          customer_initial: name ? `${name[0].toUpperCase()}.` : "—",
        } as DeliveredCar;
      })
      .filter((x): x is DeliveredCar => x !== null);
  } catch {
    return [];
  }
}

export default async function DeliveredPage() {
  const h = await headers();
  const ck = await cookies();
  const locale = ((h.get("x-tez-locale") as SeoLocale | null) ?? (getLocaleFromCookie(ck.get("NEXT_LOCALE")?.value) as SeoLocale)) || "ru";
  const c = COPY[locale];
  const delivered = await fetchDelivered();
  const nowYear = new Date().getFullYear();

  return (
    <div className="pt-24 pb-20">
      <BreadcrumbSchema
        items={[
          { name: locale === "ru" ? "Главная" : locale === "uz" ? "Bosh sahifa" : "Home", url: `${SITE_CONFIG.url}/${locale}` },
          { name: COPY[locale].title, url: `${SITE_CONFIG.url}/${locale}/delivered` },
        ]}
      />
      <div className="container-custom max-w-6xl">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">{c.h1}</h1>
        <p className="mt-6 max-w-3xl text-base md:text-lg text-muted-foreground leading-relaxed">{c.intro}</p>

        <div className="mt-8">
          <TrustBar locale={locale} deliveredCount={delivered.length} nowYear={nowYear} />
        </div>

        {delivered.length === 0 ? (
          <p className="mt-12 text-muted-foreground">{c.empty}</p>
        ) : (
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {delivered.map((d, i) => (
              <Link
                key={`${d.slug}-${i}`}
                href={localizedPath(locale, `/catalog/${d.slug}`)}
                className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors"
              >
                <div className="relative aspect-[4/3] bg-muted">
                  {d.image ? (
                    <Image src={d.image} alt={`${d.brand} ${d.model}`} fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover" />
                  ) : null}
                </div>
                <div className="p-3">
                  <div className="text-sm font-medium text-foreground">
                    {d.brand} {d.model} {d.year ?? ""}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {d.customer_initial} · {d.delivered_month}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-12">
          <Link
            href={localizedPath(locale, "/order")}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground"
          >
            {c.cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
