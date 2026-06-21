import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_CONFIG } from "@/lib/constants";
import { getLocaleFromCookie } from "@/i18n/config";
import { localizedAlternates, type SeoLocale } from "@/lib/seo/alternates";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getUsdUzsRate } from "@/lib/fx-rate";
import { PUBLIC_CAR_LIST_COLUMNS } from "@/lib/car-columns";
import { brandSlug } from "@/lib/brands";
import { modelSlug, modelFromCombinedSlug, type InventoryModel } from "@/lib/models";
import { computeCustomsUz, resolveVehicleKind, resolveVehicleAge } from "@/lib/customs-uz";
import { formatPrice } from "@/lib/utils";
import type { Car } from "@/types/car";
import { BreadcrumbSchema } from "@/components/shared/breadcrumb-schema";

/**
 * Programmatic comparison pages: /compare/<brand-model>-vs-<brand-model>.
 *
 * Targets the "<Model A> vs <Model B>" cluster. Server-rendered table built from
 * clean structured car columns (NOT the messy AutoHome spec_data blob) plus a
 * под-ключ landed cost per side from the customs engine. Resolves any valid pair
 * on demand; a curated set is also in the sitemap. Fully dynamic.
 */

const SEP = "-vs-";

async function fetchRep(brand: string, model: string): Promise<Car | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("cars")
      .select(PUBLIC_CAR_LIST_COLUMNS)
      .eq("brand", brand)
      .eq("model", model)
      .neq("inventory_status", "sold")
      .order("price_usd", { ascending: true })
      .limit(1)
      .maybeSingle();
    return (data as unknown as Car) ?? null;
  } catch {
    return null;
  }
}

function landed(car: Car, usdUzs?: number): number {
  return computeCustomsUz({
    priceUsd: car.price_usd,
    kind: resolveVehicleKind(car.fuel_type),
    age: resolveVehicleAge(car.year),
    engineCc: car.engine_volume ? Math.round(car.engine_volume * 1000) : 0,
    usdUzs,
  }).totalUsd;
}

function resolveLocale(h: Headers, cookieValue: string | undefined): SeoLocale {
  return (h.get("x-tez-locale") as SeoLocale | null) ?? (getLocaleFromCookie(cookieValue) as SeoLocale);
}

function parsePair(matchup: string): [string, string] | null {
  const i = matchup.indexOf(SEP);
  if (i < 0) return null;
  const a = matchup.slice(0, i);
  const b = matchup.slice(i + SEP.length);
  if (!a || !b || a === b) return null;
  return [a, b];
}

export async function generateMetadata(
  { params }: { params: Promise<{ matchup: string }> },
): Promise<Metadata> {
  const { matchup } = await params;
  const pair = parsePair(matchup);
  if (!pair) return { title: "Not found" };
  const [ma, mb] = await Promise.all([modelFromCombinedSlug(pair[0]), modelFromCombinedSlug(pair[1])]);
  if (!ma || !mb) return { title: "Not found" };

  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale = resolveLocale(requestHeaders, cookieStore.get("NEXT_LOCALE")?.value);
  const a = `${ma.brand} ${ma.model}`;
  const b = `${mb.brand} ${mb.model}`;

  const copy = {
    ru: { title: `${a} или ${b} — сравнение и цена в Узбекистане`, description: `Сравнение ${a} и ${b}: цена под ключ с растаможкой, характеристики, двигатель, привод. Что выбрать — Tez Motors.` },
    uz: { title: `${a} yoki ${b} — taqqoslash va narx`, description: `${a} va ${b} taqqoslovi: rastamojka bilan под ключ narx, xususiyatlar, dvigatel, haydov. Tez Motors.` },
    en: { title: `${a} vs ${b} — comparison and price in Uzbekistan`, description: `Compare ${a} and ${b}: turn-key price with customs, specs, engine, drivetrain. Tez Motors.` },
  }[locale];

  // Canonicalize to sorted order so "b-vs-a" doesn't duplicate "a-vs-b".
  const canonicalMatchup = [pair[0], pair[1]].sort().join(SEP);
  return {
    title: copy.title,
    description: copy.description,
    alternates: localizedAlternates(`/compare/models/${canonicalMatchup}`, locale),
    openGraph: { title: copy.title, description: copy.description },
  };
}

export default async function ComparePage(
  { params }: { params: Promise<{ matchup: string }> },
) {
  const { matchup } = await params;
  const pair = parsePair(matchup);
  if (!pair) notFound();

  const [ma, mb] = await Promise.all([modelFromCombinedSlug(pair[0]), modelFromCombinedSlug(pair[1])]);
  if (!ma || !mb) notFound();

  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale = resolveLocale(requestHeaders, cookieStore.get("NEXT_LOCALE")?.value);

  const [carA, carB] = await Promise.all([fetchRep(ma.brand, ma.model), fetchRep(mb.brand, mb.model)]);
  if (!carA || !carB) notFound();

  let usdUzs: number | undefined;
  try {
    usdUzs = await getUsdUzsRate(createServiceClient());
  } catch {
    /* engine falls back to DEFAULT_USD_UZS */
  }

  const nameA = `${ma.brand} ${ma.model}`;
  const nameB = `${mb.brand} ${mb.model}`;

  const L = {
    ru: {
      h1: `${nameA} или ${nameB}`,
      intro: `Сравнение ${nameA} и ${nameB} по цене под ключ (с растаможкой) и характеристикам. Цены — от самой доступной комплектации в наличии.`,
      price: "Цена авто", turnkey: "Под ключ (с растаможкой)", year: "Год", body: "Кузов", fuel: "Топливо",
      engine: "Двигатель", power: "Мощность", trans: "Коробка", drive: "Привод", range: "Запас хода", seats: "Мест",
      hp: "л.с.", l: "л", km: "км", view: "Подробнее",
      bodies: { sedan: "Седан", suv: "Внедорожник", crossover: "Кроссовер", hatchback: "Хэтчбек", minivan: "Минивэн", coupe: "Купе" },
      fuels: { petrol: "Бензин", electric: "Электро", hybrid: "Гибрид", phev: "Plug-in гибрид" },
      transs: { automatic: "Автомат", manual: "Механика", cvt: "Вариатор", robot: "Робот", dct: "DCT" },
      drives: { fwd: "Передний", rwd: "Задний", awd: "Полный" },
    },
    uz: {
      h1: `${nameA} yoki ${nameB}`,
      intro: `${nameA} va ${nameB} taqqoslovi — под ключ narx (rastamojka bilan) va xususiyatlar bo'yicha. Narxlar mavjud eng arzon komplektatsiyadan.`,
      price: "Avto narxi", turnkey: "Под ключ (rastamojka bilan)", year: "Yil", body: "Kuzov", fuel: "Yoqilg'i",
      engine: "Dvigatel", power: "Quvvat", trans: "Korobka", drive: "Haydov", range: "Yurish masofasi", seats: "O'rin",
      hp: "о.к.", l: "l", km: "km", view: "Batafsil",
      bodies: { sedan: "Sedan", suv: "SUV", crossover: "Krossover", hatchback: "Xetchbek", minivan: "Miniven", coupe: "Kupe" },
      fuels: { petrol: "Benzin", electric: "Elektro", hybrid: "Gibrid", phev: "Plug-in gibrid" },
      transs: { automatic: "Avtomat", manual: "Mexanika", cvt: "Variator", robot: "Robot", dct: "DCT" },
      drives: { fwd: "Oldi", rwd: "Orqa", awd: "To'liq" },
    },
    en: {
      h1: `${nameA} vs ${nameB}`,
      intro: `Comparing ${nameA} and ${nameB} by turn-key price (customs included) and specs. Prices start from the most affordable trim in stock.`,
      price: "Car price", turnkey: "Turn-key (customs in)", year: "Year", body: "Body", fuel: "Fuel",
      engine: "Engine", power: "Power", trans: "Gearbox", drive: "Drivetrain", range: "Range", seats: "Seats",
      hp: "hp", l: "L", km: "km", view: "Details",
      bodies: { sedan: "Sedan", suv: "SUV", crossover: "Crossover", hatchback: "Hatchback", minivan: "Minivan", coupe: "Coupe" },
      fuels: { petrol: "Petrol", electric: "Electric", hybrid: "Hybrid", phev: "Plug-in hybrid" },
      transs: { automatic: "Automatic", manual: "Manual", cvt: "CVT", robot: "AMT", dct: "DCT" },
      drives: { fwd: "FWD", rwd: "RWD", awd: "AWD" },
    },
  }[locale];

  const dash = "—";
  const fuelLabel = (c: Car) => L.fuels[c.fuel_type] ?? c.fuel_type;
  const bodyLabel = (c: Car) => L.bodies[c.body_type] ?? c.body_type;
  const transLabel = (c: Car) => L.transs[c.transmission] ?? c.transmission;
  const driveLabel = (c: Car) => (c.drivetrain ? L.drives[c.drivetrain] ?? c.drivetrain : dash);

  const rows: { label: string; a: string; b: string }[] = [
    { label: L.price, a: formatPrice(carA.price_usd), b: formatPrice(carB.price_usd) },
    { label: L.turnkey, a: formatPrice(landed(carA, usdUzs)), b: formatPrice(landed(carB, usdUzs)) },
    { label: L.year, a: String(carA.year), b: String(carB.year) },
    { label: L.body, a: bodyLabel(carA), b: bodyLabel(carB) },
    { label: L.fuel, a: fuelLabel(carA), b: fuelLabel(carB) },
    { label: L.engine, a: carA.engine_volume ? `${carA.engine_volume} ${L.l}` : dash, b: carB.engine_volume ? `${carB.engine_volume} ${L.l}` : dash },
    { label: L.power, a: carA.engine_power ? `${carA.engine_power} ${L.hp}` : dash, b: carB.engine_power ? `${carB.engine_power} ${L.hp}` : dash },
    { label: L.trans, a: transLabel(carA), b: transLabel(carB) },
    { label: L.drive, a: driveLabel(carA), b: driveLabel(carB) },
    { label: L.range, a: carA.range_km ? `${carA.range_km} ${L.km}` : dash, b: carB.range_km ? `${carB.range_km} ${L.km}` : dash },
    { label: L.seats, a: carA.seats ? String(carA.seats) : dash, b: carB.seats ? String(carB.seats) : dash },
  ];

  const modelHref = (m: InventoryModel) => `/${locale}/catalog/brand/${brandSlug(m.brand)}/${modelSlug(m.model)}`;

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: locale === "ru" ? "Главная" : locale === "uz" ? "Bosh sahifa" : "Home", url: `${SITE_CONFIG.url}/${locale}` },
          { name: locale === "ru" ? "Сравнение" : locale === "uz" ? "Taqqoslash" : "Compare", url: `${SITE_CONFIG.url}/${locale}/compare` },
          { name: L.h1, url: `${SITE_CONFIG.url}/${locale}/compare/models/${matchup}` },
        ]}
      />

      <div className="pt-24 pb-16">
        <div className="container-custom max-w-3xl space-y-8">
          <header className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">{L.h1}</h1>
            <p className="text-muted-foreground">{L.intro}</p>
          </header>

          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-4"></th>
                  <th className="text-left text-sm font-bold text-foreground px-4 py-4">
                    <Link href={modelHref(ma)} className="hover:text-primary">{nameA}</Link>
                  </th>
                  <th className="text-left text-sm font-bold text-foreground px-4 py-4">
                    <Link href={modelHref(mb)} className="hover:text-primary">{nameB}</Link>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <td className="px-4 py-3 text-xs text-muted-foreground border-t border-border">{r.label}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground border-t border-border">{r.a}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground border-t border-border">{r.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {[{ m: ma, n: nameA }, { m: mb, n: nameB }].map(({ m, n }) => (
              <Link
                key={n}
                href={modelHref(m)}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary/40"
              >
                <span className="font-semibold text-foreground">{n}</span>
                <span className="inline-flex items-center gap-1 text-sm text-primary">
                  {L.view} <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
