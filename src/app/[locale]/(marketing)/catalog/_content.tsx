"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CarCard } from "@/components/catalog/car-card";
import { CarGridSkeleton } from "@/components/catalog/car-card-skeleton";
import { RecentlyViewed } from "@/components/catalog/recently-viewed";
import dynamicImport from "next/dynamic";
// AI assistant widget — client-only, below the grid → code-split out of the initial bundle.
const FindMyCar = dynamicImport(() => import("@/components/assistant/find-my-car").then((m) => m.FindMyCar), { ssr: false });
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { CAR_BRANDS, BODY_TYPES, FUEL_TYPES } from "@/lib/constants";
import { localizedPath } from "@/lib/locale-path";
import { cn } from "@/lib/utils";
import type { Car, CarFilters } from "@/types/car";

type SortOption = "default" | "price_asc" | "price_desc" | "year_desc" | "name_asc";
const PAGE_SIZE = 24;
type Facets = {
  brands: string[]; body_types: string[]; fuel_types: string[];
  transmissions: string[]; drivetrains: string[]; seats: number[];
  year_min: number | null; year_max: number | null;
};

const TRANS_LABELS: Record<string, Record<string, string>> = {
  automatic: { ru: "Автомат", uz: "Avtomat", en: "Automatic" },
  manual: { ru: "Механика", uz: "Mexanika", en: "Manual" },
  cvt: { ru: "Вариатор", uz: "Variator", en: "CVT" },
  robot: { ru: "Робот", uz: "Robot", en: "Robot" },
  dct: { ru: "DCT", uz: "DCT", en: "DCT" },
};

interface CatalogContentInnerProps {
  /**
   * Filters to seed when no URL query string is present. Used by brand /
   * filter landing pages (e.g. /catalog/brand/byd). URL params still
   * override, so a user navigating from the brand page can layer extra
   * filters without losing the route context.
   */
  initialFilters?: CarFilters;
  /**
   * Base path for `syncToUrl` to write back to. Defaults to "/catalog".
   * Brand/filter wrappers pass their own (e.g. "/catalog/brand/byd") so
   * pinned filters stay in the route, layered filters in the query.
   */
  basePath?: string;
  /** First page rendered server-side (eliminates the initial client fetch). */
  initialCars?: Car[];
  initialTotal?: number;
}

function CatalogContent({ initialFilters, basePath = "/catalog", initialCars, initialTotal }: CatalogContentInnerProps) {
  const { locale, dictionary } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Use the server-rendered first page when this is the default view (no URL
  // filters and no pinned initialFilters); otherwise fetch on mount.
  const seeded =
    (initialCars?.length ?? 0) > 0 &&
    !initialFilters &&
    !["brand", "body_type", "fuel_type", "price_min", "price_max", "monthly_max", "mileage_max", "year_min", "year_max", "transmission", "drivetrain", "seats_min", "range_min", "power_min", "q", "sort", "page"].some(
      (k) => searchParams.get(k),
    );

  const [cars, setCars] = useState<Car[]>(initialCars ?? []);
  const [loading, setLoading] = useState(!seeded);
  const [showFilters, setShowFilters] = useState(false);
  const [total, setTotal] = useState(initialTotal ?? 0);
  // Skip the first fetch when seeded from the server; subsequent filter/page
  // changes fetch normally.
  const skipFirstFetch = useRef(seeded);
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState(searchParams.get("q") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("q") || "");

  // Initialize filters from URL params, falling back to initialFilters from
  // the wrapper page (brand / filter landing pages).
  const [filters, setFilters] = useState<CarFilters>(() => ({
    brand: searchParams.get("brand") || initialFilters?.brand || undefined,
    body_type: searchParams.get("body_type") || initialFilters?.body_type || undefined,
    fuel_type: searchParams.get("fuel_type") || initialFilters?.fuel_type || undefined,
    price_min: searchParams.get("price_min") ? parseInt(searchParams.get("price_min")!) : initialFilters?.price_min,
    price_max: searchParams.get("price_max") ? parseInt(searchParams.get("price_max")!) : initialFilters?.price_max,
    monthly_max: searchParams.get("monthly_max") ? parseInt(searchParams.get("monthly_max")!) : initialFilters?.monthly_max,
    // Used-car section pins listing_type via initialFilters; mileage_max is a user filter.
    listing_type: searchParams.get("listing_type") || initialFilters?.listing_type || undefined,
    mileage_max: searchParams.get("mileage_max") ? parseInt(searchParams.get("mileage_max")!) : initialFilters?.mileage_max,
    year_min: searchParams.get("year_min") ? parseInt(searchParams.get("year_min")!) : initialFilters?.year_min,
    year_max: searchParams.get("year_max") ? parseInt(searchParams.get("year_max")!) : initialFilters?.year_max,
    transmission: searchParams.get("transmission") || initialFilters?.transmission || undefined,
    drivetrain: searchParams.get("drivetrain") || initialFilters?.drivetrain || undefined,
    seats_min: searchParams.get("seats_min") ? parseInt(searchParams.get("seats_min")!) : initialFilters?.seats_min,
    range_min: searchParams.get("range_min") ? parseInt(searchParams.get("range_min")!) : initialFilters?.range_min,
    power_min: searchParams.get("power_min") ? parseInt(searchParams.get("power_min")!) : initialFilters?.power_min,
    search: searchParams.get("q") || undefined,
  }));

  const [sortBy, setSortBy] = useState<SortOption>(
    (searchParams.get("sort") as SortOption) || "default"
  );

  // Filter facets from LIVE inventory: every in-stock brand shows up (no more
  // hardcoded list missing brands) and body/fuel options with zero cars are
  // hidden. Seeded with the static lists, replaced once /api/cars/facets returns.
  const [facets, setFacets] = useState<Facets>({
    brands: [...CAR_BRANDS],
    body_types: BODY_TYPES.map((b) => b.value),
    fuel_types: FUEL_TYPES.map((f) => f.value),
    transmissions: [], drivetrains: [], seats: [], year_min: null, year_max: null,
  });
  useEffect(() => {
    let live = true;
    fetch("/api/cars/facets")
      .then((r) => r.json())
      .then((d) => {
        if (live && d && Array.isArray(d.brands) && d.brands.length) {
          setFacets({
            brands: d.brands, body_types: d.body_types || [], fuel_types: d.fuel_types || [],
            transmissions: d.transmissions || [], drivetrains: d.drivetrains || [], seats: d.seats || [],
            year_min: d.year_min ?? null, year_max: d.year_max ?? null,
          });
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  // Anchor to scroll back to when the page changes (so the next page starts at
  // the top of the results, not wherever the pagination buttons left the view).
  const resultsTopRef = useRef<HTMLDivElement>(null);
  const goToPage = (next: number) => {
    setPage(next);
    syncToUrl(filters, sortBy, next);
    resultsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Sync filters to URL
  const syncToUrl = useCallback((newFilters: CarFilters, newSort: SortOption, newPage = 1) => {
    const params = new URLSearchParams();
    if (newFilters.brand) params.set("brand", newFilters.brand);
    if (newFilters.body_type) params.set("body_type", newFilters.body_type);
    if (newFilters.fuel_type) params.set("fuel_type", newFilters.fuel_type);
    if (newFilters.price_min) params.set("price_min", String(newFilters.price_min));
    if (newFilters.price_max) params.set("price_max", String(newFilters.price_max));
    if (newFilters.monthly_max) params.set("monthly_max", String(newFilters.monthly_max));
    if (newFilters.mileage_max) params.set("mileage_max", String(newFilters.mileage_max));
    if (newFilters.year_min) params.set("year_min", String(newFilters.year_min));
    if (newFilters.year_max) params.set("year_max", String(newFilters.year_max));
    if (newFilters.transmission) params.set("transmission", newFilters.transmission);
    if (newFilters.drivetrain) params.set("drivetrain", newFilters.drivetrain);
    if (newFilters.seats_min) params.set("seats_min", String(newFilters.seats_min));
    if (newFilters.range_min) params.set("range_min", String(newFilters.range_min));
    if (newFilters.power_min) params.set("power_min", String(newFilters.power_min));
    if (newFilters.search) params.set("q", newFilters.search);
    if (newSort !== "default") params.set("sort", newSort);
    if (newPage > 1) params.set("page", String(newPage));
    const query = params.toString();
    router.replace(localizedPath(locale, query ? `${basePath}?${query}` : basePath), { scroll: false });
  }, [locale, router, basePath]);

  const updateFilters = (newFilters: CarFilters) => {
    setFilters(newFilters);
    setPage(1);
    syncToUrl(newFilters, sortBy, 1);
  };

  const updateSort = (newSort: SortOption) => {
    setSortBy(newSort);
    setPage(1);
    syncToUrl(filters, newSort, 1);
  };

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timeout);
  }, [searchText]);

  useEffect(() => {
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false;
      return; // first render already has the server-rendered page
    }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("page_size", String(PAGE_SIZE));
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (filters.brand) params.set("brand", filters.brand);
    if (filters.body_type) params.set("body_type", filters.body_type);
    if (filters.fuel_type) params.set("fuel_type", filters.fuel_type);
    if (filters.price_min) params.set("price_min", String(filters.price_min));
    if (filters.price_max) params.set("price_max", String(filters.price_max));
    if (filters.monthly_max) params.set("monthly_max", String(filters.monthly_max));
    if (filters.listing_type) params.set("listing_type", filters.listing_type);
    if (filters.mileage_max) params.set("mileage_max", String(filters.mileage_max));
    if (filters.year_min) params.set("year_min", String(filters.year_min));
    if (filters.year_max) params.set("year_max", String(filters.year_max));
    if (filters.transmission) params.set("transmission", filters.transmission);
    if (filters.drivetrain) params.set("drivetrain", filters.drivetrain);
    if (filters.seats_min) params.set("seats_min", String(filters.seats_min));
    if (filters.range_min) params.set("range_min", String(filters.range_min));
    if (filters.power_min) params.set("power_min", String(filters.power_min));
    if (sortBy !== "default") params.set("sort", sortBy);

    fetch(`/api/cars?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setCars(data.cars || []);
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, filters, sortBy, debouncedSearch]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const resetFilters = () => {
    setSearchText("");
    setDebouncedSearch("");
    setPage(1);
    updateFilters({});
  };

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading
          as="h1"
          title={dictionary.catalog.title}
          subtitle={dictionary.catalog.subtitle}
        />

        {/* AI car finder */}
        <div className="max-w-3xl mx-auto mb-8">
          <FindMyCar />
        </div>

        {/* Search bar */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder={dictionary.catalog.filters.search}
              value={searchText}
              onChange={(e) => {
                const value = e.target.value;
                setSearchText(value);
                updateFilters({ ...filters, search: value || undefined });
              }}
              className="pl-12 h-14 text-base rounded-2xl"
            />
          </div>
        </div>

        {/* Filter toggle for mobile + count + sort */}
        <div ref={resultsTopRef} className="flex items-center justify-between mb-6 scroll-mt-24">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="lg:hidden"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="default" className="ml-1">{activeFilterCount}</Badge>
            )}
          </Button>
          <div className="flex items-center gap-3 ml-auto">
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{loading ? "..." : `${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, total)}`} / {total}</span> {dictionary.catalog.filters.results}
            </p>
            <select
              value={sortBy}
              onChange={(e) => updateSort(e.target.value as SortOption)}
              className="h-9 rounded-lg border border-border px-3 text-xs bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-neon-blue"
            >
              <option value="default">{locale === "ru" ? "По умолчанию" : "Default"}</option>
              <option value="price_asc">{locale === "ru" ? "Цена ↑" : "Price ↑"}</option>
              <option value="price_desc">{locale === "ru" ? "Цена ↓" : "Price ↓"}</option>
              <option value="year_desc">{locale === "ru" ? "Новые" : "Newest"}</option>
              <option value="name_asc">{locale === "ru" ? "По имени" : "Name A-Z"}</option>
            </select>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Filters sidebar */}
          <aside className={cn(
            "shrink-0 w-64 space-y-6",
            showFilters ? "block fixed inset-0 z-50 bg-card p-6 overflow-y-auto lg:relative lg:inset-auto lg:z-auto lg:bg-transparent lg:p-0" : "hidden lg:block"
          )}>
            {showFilters && (
              <div className="flex items-center justify-between lg:hidden mb-4">
                <h3 className="font-bold text-lg">Filters</h3>
                <button onClick={() => setShowFilters(false)}>
                  <X className="w-6 h-6" />
                </button>
              </div>
            )}

            {/* Brand filter — a dropdown populated from live inventory (48 brands),
                so it stays compact and always lists every in-stock brand. */}
            <div>
              <h4 className="text-sm font-semibold mb-3">{dictionary.catalog.filters.brand}</h4>
              <select
                value={filters.brand || ""}
                onChange={(e) => updateFilters({ ...filters, brand: e.target.value || undefined })}
                className="w-full h-10 rounded-lg border border-border bg-card text-foreground px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neon-blue"
              >
                <option value="">{dictionary.catalog.filters.allBrands}</option>
                {facets.brands.map((brand) => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>

            {/* Body type filter */}
            <div>
              <h4 className="text-sm font-semibold mb-3">{dictionary.catalog.filters.bodyType}</h4>
              <div className="flex flex-wrap gap-2">
                {facets.body_types.map((value) => {
                  const label = BODY_TYPES.find((b) => b.value === value)?.label[locale] || value;
                  return (
                    <button
                      key={value}
                      onClick={() => updateFilters({ ...filters, body_type: filters.body_type === value ? undefined : value })}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                        filters.body_type === value
                          ? "bg-neon-blue/15 border-neon-blue text-neon-blue"
                          : "border-border text-muted-foreground hover:bg-foreground/5"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fuel type filter */}
            <div>
              <h4 className="text-sm font-semibold mb-3">{dictionary.catalog.filters.fuelType}</h4>
              <div className="flex flex-wrap gap-2">
                {facets.fuel_types.map((value) => {
                  const label = FUEL_TYPES.find((f) => f.value === value)?.label[locale] || value;
                  return (
                    <button
                      key={value}
                      onClick={() => updateFilters({ ...filters, fuel_type: filters.fuel_type === value ? undefined : value })}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                        filters.fuel_type === value
                          ? "bg-neon-blue/15 border-neon-blue text-neon-blue"
                          : "border-border text-muted-foreground hover:bg-foreground/5"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price range filter */}
            <div>
              <h4 className="text-sm font-semibold mb-3">{dictionary.catalog.filters.priceRange}</h4>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.price_min || ""}
                    onChange={(e) => updateFilters({ ...filters, price_min: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full h-9 rounded-lg border border-border bg-card text-foreground px-3 text-xs focus:outline-none focus:ring-2 focus:ring-neon-blue"
                  />
                  <span className="text-muted-foreground self-center">—</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.price_max || ""}
                    onChange={(e) => updateFilters({ ...filters, price_max: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full h-9 rounded-lg border border-border bg-card text-foreground px-3 text-xs focus:outline-none focus:ring-2 focus:ring-neon-blue"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "< $20k", min: undefined, max: 20000 },
                    { label: "$20-30k", min: 20000, max: 30000 },
                    { label: "$30-40k", min: 30000, max: 40000 },
                    { label: "> $40k", min: 40000, max: undefined },
                  ].map((range, i) => (
                    <button
                      key={i}
                      onClick={() => updateFilters({ ...filters, price_min: range.min, price_max: range.max })}
                      className={cn(
                        "px-2 py-1 rounded-md text-[11px] font-mono font-medium border transition-colors",
                        filters.price_min === range.min && filters.price_max === range.max
                          ? "bg-neon-blue/15 border-neon-blue text-neon-blue"
                          : "border-border text-muted-foreground hover:bg-foreground/5"
                      )}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Monthly budget filter (installments) */}
            <div>
              <h4 className="text-sm font-semibold mb-3">
                {locale === "ru" ? "Платёж в месяц" : locale === "uz" ? "Oylik to'lov" : "Monthly budget"}
              </h4>
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="number"
                    placeholder={locale === "ru" ? "До $/мес" : locale === "uz" ? "$/oygacha" : "Up to $/mo"}
                    value={filters.monthly_max || ""}
                    onChange={(e) => updateFilters({ ...filters, monthly_max: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full h-9 rounded-lg border border-border bg-card text-foreground px-3 text-xs focus:outline-none focus:ring-2 focus:ring-neon-blue"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[300, 500, 800, 1200].map((m) => (
                    <button
                      key={m}
                      onClick={() => updateFilters({ ...filters, monthly_max: filters.monthly_max === m ? undefined : m })}
                      className={cn(
                        "px-2 py-1 rounded-md text-[11px] font-mono font-medium border transition-colors",
                        filters.monthly_max === m
                          ? "bg-neon-blue/15 border-neon-blue text-neon-blue"
                          : "border-border text-muted-foreground hover:bg-foreground/5"
                      )}
                    >
                      ${m}/{locale === "ru" ? "мес" : locale === "uz" ? "oy" : "mo"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Year range */}
            <div>
              <h4 className="text-sm font-semibold mb-3">{locale === "ru" ? "Год" : locale === "uz" ? "Yil" : "Year"}</h4>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder={facets.year_min ? `от ${facets.year_min}` : (locale === "ru" ? "от" : "from")}
                  value={filters.year_min || ""}
                  onChange={(e) => updateFilters({ ...filters, year_min: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full h-9 rounded-lg border border-border bg-card text-foreground px-3 text-xs focus:outline-none focus:ring-2 focus:ring-neon-blue"
                />
                <span className="text-muted-foreground self-center">—</span>
                <input
                  type="number"
                  placeholder={facets.year_max ? `до ${facets.year_max}` : (locale === "ru" ? "до" : "to")}
                  value={filters.year_max || ""}
                  onChange={(e) => updateFilters({ ...filters, year_max: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full h-9 rounded-lg border border-border bg-card text-foreground px-3 text-xs focus:outline-none focus:ring-2 focus:ring-neon-blue"
                />
              </div>
            </div>

            {/* Drivetrain */}
            {facets.drivetrains.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3">{locale === "ru" ? "Привод" : locale === "uz" ? "Uzatma" : "Drivetrain"}</h4>
                <div className="flex flex-wrap gap-2">
                  {facets.drivetrains.map((dt) => (
                    <button
                      key={dt}
                      onClick={() => updateFilters({ ...filters, drivetrain: filters.drivetrain === dt ? undefined : dt })}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border uppercase",
                        filters.drivetrain === dt ? "bg-neon-blue/15 border-neon-blue text-neon-blue" : "border-border text-muted-foreground hover:bg-foreground/5"
                      )}
                    >
                      {dt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Seats (min) */}
            {facets.seats.filter((n) => n >= 4).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3">{locale === "ru" ? "Мест" : locale === "uz" ? "O'rindiqlar" : "Seats"}</h4>
                <div className="flex flex-wrap gap-2">
                  {[...new Set(facets.seats.filter((n) => n >= 4))].sort((a, b) => a - b).map((n) => (
                    <button
                      key={n}
                      onClick={() => updateFilters({ ...filters, seats_min: filters.seats_min === n ? undefined : n })}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors border",
                        filters.seats_min === n ? "bg-neon-blue/15 border-neon-blue text-neon-blue" : "border-border text-muted-foreground hover:bg-foreground/5"
                      )}
                    >
                      {n}+
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Power (min hp) */}
            <div>
              <h4 className="text-sm font-semibold mb-3">{locale === "ru" ? "Мощность" : locale === "uz" ? "Quvvat" : "Power"}</h4>
              <div className="flex flex-wrap gap-2">
                {[150, 250, 400].map((hp) => (
                  <button
                    key={hp}
                    onClick={() => updateFilters({ ...filters, power_min: filters.power_min === hp ? undefined : hp })}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors border",
                      filters.power_min === hp ? "bg-neon-blue/15 border-neon-blue text-neon-blue" : "border-border text-muted-foreground hover:bg-foreground/5"
                    )}
                  >
                    {hp}+ {locale === "ru" ? "л.с." : "hp"}
                  </button>
                ))}
              </div>
            </div>

            {/* Electric range (min km) */}
            <div>
              <h4 className="text-sm font-semibold mb-3">{locale === "ru" ? "Запас хода (электро)" : locale === "uz" ? "Yurish masofasi (elektr)" : "Electric range"}</h4>
              <div className="flex flex-wrap gap-2">
                {[400, 500, 600].map((km) => (
                  <button
                    key={km}
                    onClick={() => updateFilters({ ...filters, range_min: filters.range_min === km ? undefined : km })}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors border",
                      filters.range_min === km ? "bg-neon-blue/15 border-neon-blue text-neon-blue" : "border-border text-muted-foreground hover:bg-foreground/5"
                    )}
                  >
                    {km}+ {locale === "ru" ? "км" : "km"}
                  </button>
                ))}
              </div>
            </div>

            {/* Transmission */}
            {facets.transmissions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3">{locale === "ru" ? "Коробка" : locale === "uz" ? "Uzatmalar qutisi" : "Transmission"}</h4>
                <div className="flex flex-wrap gap-2">
                  {facets.transmissions.map((tr) => (
                    <button
                      key={tr}
                      onClick={() => updateFilters({ ...filters, transmission: filters.transmission === tr ? undefined : tr })}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                        filters.transmission === tr ? "bg-neon-blue/15 border-neon-blue text-neon-blue" : "border-border text-muted-foreground hover:bg-foreground/5"
                      )}
                    >
                      {TRANS_LABELS[tr]?.[locale] || tr}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mileage (max) */}
            <div>
              <h4 className="text-sm font-semibold mb-3">{locale === "ru" ? "Пробег, до (км)" : locale === "uz" ? "Probeg, gacha (km)" : "Max mileage (km)"}</h4>
              <input
                type="number"
                placeholder={locale === "ru" ? "напр. 50000" : "e.g. 50000"}
                value={filters.mileage_max || ""}
                onChange={(e) => updateFilters({ ...filters, mileage_max: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full h-9 rounded-lg border border-border bg-card text-foreground px-3 text-xs focus:outline-none focus:ring-2 focus:ring-neon-blue"
              />
            </div>

            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="w-full">
                <X className="w-4 h-4" />
                {dictionary.catalog.filters.reset}
              </Button>
            )}
          </aside>

          {/* Car grid */}
          <div className="flex-1">
            {loading ? (
              <div className="text-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-neon-blue mx-auto mb-3" />
                <p className="text-muted-foreground">{locale === "ru" ? "Загрузка..." : "Loading..."}</p>
              </div>
            ) : cars.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-muted-foreground text-lg">{dictionary.catalog.noResults}</p>
                <Button variant="outline" onClick={resetFilters} className="mt-4">
                  {dictionary.catalog.filters.reset}
                </Button>
                {/* High-intent moment: nothing in stock matched — offer to import it. */}
                <div className="mt-8 pt-6 border-t border-border max-w-md mx-auto">
                  <p className="text-muted-foreground text-sm">
                    {locale === "uz"
                      ? "Kerakli mashinani topmadingizmi? Biz uni Xitoydan buyurtma asosida olib kelamiz."
                      : locale === "en"
                      ? "Didn't find the car you want? We'll import the exact trim and colour from China."
                      : "Не нашли нужную машину? Привезём именно ту комплектацию и цвет из Китая под заказ."}
                  </p>
                  <Button asChild className="mt-3">
                    <Link href={localizedPath(locale, "/order")}>
                      {locale === "uz" ? "Buyurtma berish →" : locale === "en" ? "Order a car →" : "Заказать под импорт →"}
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {cars.map((car, index) => (
                  <div
                    key={car.id}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <CarCard car={car} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {!loading && total > PAGE_SIZE && (() => {
          const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
          // Windowed page list: 1 … (p-1) p (p+1) … last — clickable so you can
          // jump straight to a page instead of stepping one at a time.
          const nums: (number | "…")[] = [];
          for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) nums.push(i);
            else if (nums[nums.length - 1] !== "…") nums.push("…");
          }
          const prevLabel = locale === "ru" ? "Назад" : locale === "uz" ? "Orqaga" : "Prev";
          const nextLabel = locale === "ru" ? "Вперёд" : locale === "uz" ? "Oldinga" : "Next";
          return (
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" onClick={() => goToPage(Math.max(1, page - 1))} disabled={page === 1}>
                {prevLabel}
              </Button>
              {nums.map((n, i) =>
                n === "…" ? (
                  <span key={`gap-${i}`} className="px-1 text-muted-foreground select-none">…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => goToPage(n)}
                    aria-current={n === page ? "page" : undefined}
                    className={cn(
                      "min-w-10 h-10 px-2 rounded-lg text-sm font-mono transition-colors border",
                      n === page
                        ? "bg-neon-blue/15 border-neon-blue text-neon-blue font-semibold"
                        : "border-border text-muted-foreground hover:bg-foreground/5"
                    )}
                  >
                    {n}
                  </button>
                )
              )}
              <Button variant="outline" onClick={() => goToPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
                {nextLabel}
              </Button>
            </div>
          );
        })()}

        {/* Recently viewed */}
        <RecentlyViewed />
      </div>
    </div>
  );
}

export default function CatalogContentWrapper(props: CatalogContentInnerProps = {}) {
  return (
    <Suspense fallback={<CarGridSkeleton count={9} />}>
      <CatalogContent {...props} />
    </Suspense>
  );
}
