import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocaleFromCookie } from "@/i18n/config";
import { localizedAlternates, type SeoLocale } from "@/lib/seo/alternates";
import { CarCard } from "@/components/catalog/car-card";
import type { Car } from "@/types/car";

/**
 * Public deals page: every car currently on sale (original_price_usd above the
 * live price — set manually or by the promotions engine). A shareable, SEO-
 * friendly landing page and the target for the auto-posted Telegram promo links.
 */
export const dynamic = "force-dynamic";

const COPY: Record<SeoLocale, { title: string; description: string; intro: string; empty: string; cta: string }> = {
  ru: {
    title: "Скидки и акции — Tez Motors",
    description: "Автомобили со скидкой от Tez Motors: ограниченные предложения на импорт из Китая. Актуальные цены и экономия.",
    intro: "Автомобили со скидкой прямо сейчас. Предложения ограничены по времени — успейте забронировать.",
    empty: "Сейчас активных акций нет. Загляните в каталог — подберём вариант под вас.",
    cta: "Перейти в каталог",
  },
  uz: {
    title: "Chegirmalar va aksiyalar — Tez Motors",
    description: "Tez Motors'dan chegirmadagi avtomobillar: Xitoydan importga cheklangan takliflar.",
    intro: "Hozir chegirmadagi avtomobillar. Takliflar vaqt bilan cheklangan — band qilishga ulguring.",
    empty: "Hozircha faol aksiyalar yo'q. Katalogga o'ting — siz uchun variant tanlaymiz.",
    cta: "Katalogga o'tish",
  },
  en: {
    title: "Deals & offers — Tez Motors",
    description: "Discounted cars from Tez Motors: limited-time offers on China import. Live prices and savings.",
    intro: "Cars on sale right now. Offers are time-limited — reserve before they're gone.",
    empty: "No active deals right now. Browse the catalog — we'll find the right car for you.",
    cta: "Go to catalog",
  },
};

function resolveLocale(h: Headers, c: { get: (n: string) => { value?: string } | undefined }): SeoLocale {
  return (h.get("x-tez-locale") as SeoLocale | null) ?? (getLocaleFromCookie(c.get("NEXT_LOCALE")?.value) as SeoLocale);
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale(await headers(), await cookies());
  const c = COPY[locale];
  return { title: c.title, description: c.description, alternates: localizedAlternates("/deals", locale), openGraph: { title: c.title, description: c.description } };
}

export default async function DealsPage() {
  const locale = resolveLocale(await headers(), await cookies());
  const c = COPY[locale];

  let cars: Car[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("cars")
      .select("*")
      .neq("inventory_status", "sold")
      .not("original_price_usd", "is", null)
      .limit(60);
    cars = ((data || []) as Car[])
      .filter((car) => car.original_price_usd != null && car.original_price_usd > car.price_usd)
      .sort((a, b) => (1 - a.price_usd / (a.original_price_usd as number)) < (1 - b.price_usd / (b.original_price_usd as number)) ? 1 : -1);
  } catch {
    cars = [];
  }

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gradient">{c.title}</h1>
        <p className="mt-4 text-base md:text-lg text-white/70 max-w-3xl">{c.intro}</p>

        {cars.length === 0 ? (
          <div className="mt-10 text-white/60">
            <p>{c.empty}</p>
            <Link href={`/${locale}/catalog`} className="inline-block mt-4 text-primary hover:underline">{c.cta} →</Link>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cars.map((car) => <CarCard key={car.id} car={car} />)}
          </div>
        )}
      </div>
    </div>
  );
}
