"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CarCard } from "@/components/catalog/car-card";
import { CarGridSkeleton } from "@/components/catalog/car-card-skeleton";
import { RecentlyViewed } from "@/components/catalog/recently-viewed";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { CAR_BRANDS, BODY_TYPES, FUEL_TYPES } from "@/lib/constants";
import { localizedPath } from "@/lib/locale-path";
import { cn } from "@/lib/utils";
import type { Car, CarFilters } from "@/types/car";

type SortOption = "default" | "price_asc" | "price_desc" | "year_desc" | "name_asc";
const PAGE_SIZE = 12;

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
}

function CatalogContent({ initialFilters, basePath = "/catalog" }: CatalogContentInnerProps) {
  const { locale, dictionary } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [total, setTotal] = useState(0);
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
    search: searchParams.get("q") || undefined,
  }));

  const [sortBy, setSortBy] = useState<SortOption>(
    (searchParams.get("sort") as SortOption) || "default"
  );

  // Sync filters to URL
  const syncToUrl = useCallback((newFilters: CarFilters, newSort: SortOption, newPage = 1) => {
    const params = new URLSearchParams();
    if (newFilters.brand) params.set("brand", newFilters.brand);
    if (newFilters.body_type) params.set("body_type", newFilters.body_type);
    if (newFilters.fuel_type) params.set("fuel_type", newFilters.fuel_type);
    if (newFilters.price_min) params.set("price_min", String(newFilters.price_min));
    if (newFilters.price_max) params.set("price_max", String(newFilters.price_max));
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

        {/* Search bar */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
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
        <div className="flex items-center justify-between mb-6">
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
            <p className="text-sm text-white/60">
              {loading ? "..." : `${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, total)}`} / {total} {dictionary.catalog.filters.results}
            </p>
            <select
              value={sortBy}
              onChange={(e) => updateSort(e.target.value as SortOption)}
              className="h-9 rounded-lg border border-white/10 px-3 text-xs bg-[#0d0d15] text-white focus:outline-none focus:ring-2 focus:ring-neon-blue"
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
            showFilters ? "block fixed inset-0 z-50 bg-[#0d0d15] p-6 overflow-y-auto lg:relative lg:inset-auto lg:z-auto lg:bg-transparent lg:p-0" : "hidden lg:block"
          )}>
            {showFilters && (
              <div className="flex items-center justify-between lg:hidden mb-4">
                <h3 className="font-bold text-lg">Filters</h3>
                <button onClick={() => setShowFilters(false)}>
                  <X className="w-6 h-6" />
                </button>
              </div>
            )}

            {/* Brand filter */}
            <div>
              <h4 className="text-sm font-semibold mb-3">{dictionary.catalog.filters.brand}</h4>
              <div className="space-y-1">
                <button
                  onClick={() => updateFilters({ ...filters, brand: undefined })}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                    !filters.brand ? "bg-neon-blue/15 text-neon-blue font-semibold" : "text-white/60 hover:bg-white/5"
                  )}
                >
                  {dictionary.catalog.filters.allBrands}
                </button>
                {CAR_BRANDS.map((brand) => (
                  <button
                    key={brand}
                    onClick={() => updateFilters({ ...filters, brand: filters.brand === brand ? undefined : brand })}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                      filters.brand === brand ? "bg-neon-blue/15 text-neon-blue font-semibold" : "text-white/60 hover:bg-white/5"
                    )}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </div>

            {/* Body type filter */}
            <div>
              <h4 className="text-sm font-semibold mb-3">{dictionary.catalog.filters.bodyType}</h4>
              <div className="flex flex-wrap gap-2">
                {BODY_TYPES.map((bt) => (
                  <button
                    key={bt.value}
                    onClick={() => updateFilters({ ...filters, body_type: filters.body_type === bt.value ? undefined : bt.value })}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                      filters.body_type === bt.value
                        ? "bg-neon-blue/15 border-neon-blue text-neon-blue"
                        : "border-white/10 text-white/60 hover:bg-white/5"
                    )}
                  >
                    {bt.label[locale]}
                  </button>
                ))}
              </div>
            </div>

            {/* Fuel type filter */}
            <div>
              <h4 className="text-sm font-semibold mb-3">{dictionary.catalog.filters.fuelType}</h4>
              <div className="flex flex-wrap gap-2">
                {FUEL_TYPES.map((ft) => (
                  <button
                    key={ft.value}
                    onClick={() => updateFilters({ ...filters, fuel_type: filters.fuel_type === ft.value ? undefined : ft.value })}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                      filters.fuel_type === ft.value
                        ? "bg-neon-blue/15 border-neon-blue text-neon-blue"
                        : "border-white/10 text-white/60 hover:bg-white/5"
                    )}
                  >
                    {ft.label[locale]}
                  </button>
                ))}
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
                    className="w-full h-9 rounded-lg border border-white/10 bg-[#0d0d15] text-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-neon-blue"
                  />
                  <span className="text-white/60 self-center">—</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.price_max || ""}
                    onChange={(e) => updateFilters({ ...filters, price_max: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full h-9 rounded-lg border border-white/10 bg-[#0d0d15] text-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-neon-blue"
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
                        "px-2 py-1 rounded-md text-[11px] font-medium border transition-colors",
                        filters.price_min === range.min && filters.price_max === range.max
                          ? "bg-neon-blue/15 border-neon-blue text-neon-blue"
                          : "border-white/10 text-white/60 hover:bg-white/5"
                      )}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>
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
                <p className="text-white/60">{locale === "ru" ? "Загрузка..." : "Loading..."}</p>
              </div>
            ) : cars.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-white/60 text-lg">{dictionary.catalog.noResults}</p>
                <Button variant="outline" onClick={resetFilters} className="mt-4">
                  {dictionary.catalog.filters.reset}
                </Button>
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

        {!loading && total > PAGE_SIZE && (
          <div className="mt-10 flex items-center justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => setPage((p) => {
                const next = Math.max(1, p - 1);
                syncToUrl(filters, sortBy, next);
                return next;
              })}
              disabled={page === 1}
            >
              Prev
            </Button>
            <span className="text-sm text-white/60">
              Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage((p) => {
                const next = p * PAGE_SIZE >= total ? p : p + 1;
                syncToUrl(filters, sortBy, next);
                return next;
              })}
              disabled={page * PAGE_SIZE >= total}
            >
              Next
            </Button>
          </div>
        )}

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
