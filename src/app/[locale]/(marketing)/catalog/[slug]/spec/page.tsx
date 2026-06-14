import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SITE_CONFIG } from "@/lib/constants";
import { getLocaleFromCookie } from "@/i18n/config";
import { localizedAlternates, type SeoLocale } from "@/lib/seo/alternates";
import { localizedPath } from "@/lib/locale-path";
import { BreadcrumbSchema } from "@/components/shared/breadcrumb-schema";
import { localizedSpecView, matchGonzoToTrims, type SpecData } from "@/lib/autohome-spec";
import { SpecComparison } from "@/components/catalog/spec-comparison";

/**
 * Public, shareable, print-friendly spec sheet — the full multi-trim parameter
 * configuration captured from AutoHome into cars.spec_data (Phase AD). Trims are
 * columns; parameters grouped into sections. "Download PDF" hits the spec-sheet
 * route (AD-4); the Vostro Playwright renders THIS page (print CSS) to PDF.
 */

const T = {
  ru: { sheet: "Спецификация", trim: "Комплектация", download: "Скачать PDF", back: "← К автомобилю", price: "Цена", noData: "Подробная спецификация пока не загружена.", ref: "Данные приведены для справки. Уточняйте актуальную комплектацию у менеджера.", param: "Параметр", differencesOnly: "Только отличия", showAll: "Все параметры", selectTrims: "Выберите комплектации для сравнения", noDiff: "Нет отличий" },
  uz: { sheet: "Texnik tavsif", trim: "Komplektatsiya", download: "PDF yuklab olish", back: "← Avtomobilga", price: "Narx", noData: "Batafsil texnik tavsif hali yuklanmagan.", ref: "Ma'lumotlar ma'lumot uchun. Aniq komplektatsiyani menejerdan so'rang.", param: "Parametr", differencesOnly: "Faqat farqlar", showAll: "Barcha parametrlar", selectTrims: "Solishtirish uchun komplektatsiyalarni tanlang", noDiff: "Farq yo'q" },
  en: { sheet: "Specification sheet", trim: "Trim", download: "Download PDF", back: "← Back to car", price: "Price", noData: "No detailed spec sheet imported yet.", ref: "Figures are for reference. Confirm the exact configuration with a manager.", param: "Parameter", differencesOnly: "Differences only", showAll: "All parameters", selectTrims: "Select trims to compare", noDiff: "No differences" },
};

async function resolveLocale(): Promise<SeoLocale> {
  const h = await headers();
  const c = await cookies();
  return (h.get("x-tez-locale") as SeoLocale | null) ?? (getLocaleFromCookie(c.get("NEXT_LOCALE")?.value) as SeoLocale);
}

async function fetchCar(slug: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("cars")
      .select("id, slug, brand, model, year, price_usd, images, thumbnail, spec_data")
      .eq("slug", slug)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const car = await fetchCar(slug);
  const locale = await resolveLocale();
  if (!car) return { title: "Spec sheet" };
  const name = `${car.brand} ${car.model}${car.year ? ` ${car.year}` : ""}`;
  return {
    title: `${name} — ${T[locale].sheet} | Tez Motors`,
    description: `${name}: full specification — engine, dimensions, features across trims. Tez Motors.`,
    alternates: localizedAlternates(`/catalog/${slug}/spec`, locale),
    robots: { index: false }, // reference page; the car detail page is the canonical indexable one
  };
}

export default async function SpecSheetPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const car = await fetchCar(slug);
  if (!car) notFound();
  const locale = await resolveLocale();
  const t = T[locale];
  const spec = (car.spec_data || null) as SpecData | null;
  const name = `${car.brand} ${car.model}${car.year ? ` ${car.year}` : ""}`;
  const gallery: string[] = (spec?.gallery?.length ? spec.gallery : (car.images as string[] | null) || []).slice(0, 4);
  // CN specs carry translated i18n[locale] views (Chinese base); global specs render their EN base.
  const view = spec ? localizedSpecView(spec, locale) : null;
  const groups = view?.groups ?? [];
  const trims = view?.trims ?? [];
  // Best-effort per-trim Gonzo price, aligned to spec.trims (== view.trims order).
  const trimPrices = spec ? matchGonzoToTrims(spec.trims, spec.gonzo_trims) : [];

  return (
    <div className="pt-24 pb-20">
      {/* Print CSS: hide the marketing chrome so the page (and its PDF) is a clean sheet. */}
      <style>{`@media print {
        header, footer, [data-print-hide], .fixed { display: none !important; }
        .pt-24 { padding-top: 0 !important; }
        body { background: #fff !important; }
        .spec-table { page-break-inside: auto; }
        .spec-group { page-break-inside: avoid; }
      }`}</style>
      <BreadcrumbSchema
        items={[
          { name: locale === "ru" ? "Главная" : locale === "uz" ? "Bosh sahifa" : "Home", url: `${SITE_CONFIG.url}/${locale}` },
          { name: locale === "ru" ? "Каталог" : locale === "uz" ? "Katalog" : "Catalog", url: `${SITE_CONFIG.url}/${locale}/catalog` },
          { name, url: `${SITE_CONFIG.url}/${locale}/catalog/${slug}/spec` },
        ]}
      />
      <div className="container-custom max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-[var(--accent)]">{t.sheet} · Tez Motors</p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mt-1">{name}</h1>
            {car.price_usd ? <p className="text-lg text-muted-foreground mt-1">{t.price}: ${Number(car.price_usd).toLocaleString("en-US")}</p> : null}
          </div>
          <div className="flex gap-2" data-print-hide>
            <Link href={localizedPath(locale, `/catalog/${slug}`)} className="inline-flex items-center rounded-xl border border-border px-4 py-2 text-sm text-foreground/90 hover:bg-white/5">{t.back}</Link>
            {/* Public PDF spec-sheet download removed — clients view the spec on-page only. */}
          </div>
        </div>

        {/* Gallery */}
        {gallery.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
            {gallery.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt={`${name} ${i + 1}`} className={`w-full ${i === 0 ? "col-span-2 sm:col-span-2 aspect-[16/10]" : "aspect-[4/3]"} object-cover rounded-xl border border-border bg-card`} loading="lazy" />
            ))}
          </div>
        )}

        {/* Spec comparison — smart multi-trim table (differences-only by default).
            Chinese (AutoHome ¥) trim prices are NOT passed to the client. */}
        {!spec || trims.length === 0 ? (
          <p className="text-muted-foreground">{t.noData}</p>
        ) : (
          <SpecComparison
            groups={groups}
            trims={trims}
            trimPrices={trimPrices}
            labels={{ param: t.param, differencesOnly: t.differencesOnly, showAll: t.showAll, selectTrims: t.selectTrims, noDiff: t.noDiff }}
          />
        )}

        <p className="text-[11px] text-muted-foreground mt-8">{t.ref}</p>
        <p className="text-[11px] text-muted-foreground mt-1">Tez Motors · {SITE_CONFIG.phone} · {SITE_CONFIG.address}</p>
      </div>
    </div>
  );
}
