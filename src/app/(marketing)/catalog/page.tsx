"use client";

import { useState, useMemo } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CarCard } from "@/components/catalog/car-card";
import { RecentlyViewed } from "@/components/catalog/recently-viewed";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { MOCK_CARS } from "@/lib/mock-data";
import { formatPrice } from "@/lib/utils";
import { CAR_BRANDS, BODY_TYPES, FUEL_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { CarFilters } from "@/types/car";

type SortOption = "default" | "price_asc" | "price_desc" | "year_desc" | "name_asc";

export default function CatalogPage() {
  const { locale, dictionary } = useLocale();
  const [filters, setFilters] = useState<CarFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("default");

  const filteredCars = useMemo(() => {
    let cars = MOCK_CARS.filter((car) => {
      if (filters.brand && car.brand !== filters.brand) return false;
      if (filters.body_type && car.body_type !== filters.body_type) return false;
      if (filters.fuel_type && car.fuel_type !== filters.fuel_type) return false;
      if (filters.price_min && car.price_usd < filters.price_min) return false;
      if (filters.price_max && car.price_usd > filters.price_max) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const match = `${car.brand} ${car.model}`.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    // Sort
    switch (sortBy) {
      case "price_asc": cars.sort((a, b) => a.price_usd - b.price_usd); break;
      case "price_desc": cars.sort((a, b) => b.price_usd - a.price_usd); break;
      case "year_desc": cars.sort((a, b) => b.year - a.year); break;
      case "name_asc": cars.sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`)); break;
    }

    return cars;
  }, [filters, sortBy]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const resetFilters = () => setFilters({});

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading
          title={dictionary.catalog.title}
          subtitle={dictionary.catalog.subtitle}
        />

        {/* Search bar */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder={dictionary.catalog.filters.search}
              value={filters.search || ""}
              onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
              className="pl-12 h-14 text-base rounded-2xl"
            />
          </div>
        </div>

        {/* Filter toggle for mobile */}
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
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {filteredCars.length} {dictionary.catalog.filters.results}
            </p>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-9 rounded-lg border border-border px-3 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-lime"
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
            showFilters ? "block fixed inset-0 z-50 bg-white p-6 overflow-y-auto lg:relative lg:inset-auto lg:z-auto lg:bg-transparent lg:p-0" : "hidden lg:block"
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
                  onClick={() => setFilters({ ...filters, brand: undefined })}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                    !filters.brand ? "bg-lime/15 text-lime-dark font-semibold" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {dictionary.catalog.filters.allBrands}
                </button>
                {CAR_BRANDS.map((brand) => (
                  <button
                    key={brand}
                    onClick={() => setFilters({ ...filters, brand: filters.brand === brand ? undefined : brand })}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                      filters.brand === brand ? "bg-lime/15 text-lime-dark font-semibold" : "text-muted-foreground hover:bg-muted"
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
                    onClick={() => setFilters({ ...filters, body_type: filters.body_type === bt.value ? undefined : bt.value })}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                      filters.body_type === bt.value
                        ? "bg-lime/15 border-lime text-lime-dark"
                        : "border-border text-muted-foreground hover:bg-muted"
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
                    onClick={() => setFilters({ ...filters, fuel_type: filters.fuel_type === ft.value ? undefined : ft.value })}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                      filters.fuel_type === ft.value
                        ? "bg-lime/15 border-lime text-lime-dark"
                        : "border-border text-muted-foreground hover:bg-muted"
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
                    onChange={(e) => setFilters({ ...filters, price_min: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full h-9 rounded-lg border border-border px-3 text-xs focus:outline-none focus:ring-2 focus:ring-lime"
                  />
                  <span className="text-muted-foreground self-center">—</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.price_max || ""}
                    onChange={(e) => setFilters({ ...filters, price_max: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full h-9 rounded-lg border border-border px-3 text-xs focus:outline-none focus:ring-2 focus:ring-lime"
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
                      onClick={() => setFilters({ ...filters, price_min: range.min, price_max: range.max })}
                      className={cn(
                        "px-2 py-1 rounded-md text-[11px] font-medium border transition-colors",
                        filters.price_min === range.min && filters.price_max === range.max
                          ? "bg-lime/15 border-lime text-lime-dark"
                          : "border-border text-muted-foreground hover:bg-muted"
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
            {filteredCars.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-muted-foreground text-lg">{dictionary.catalog.noResults}</p>
                <Button variant="outline" onClick={resetFilters} className="mt-4">
                  {dictionary.catalog.filters.reset}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredCars.map((car, index) => (
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

        {/* Recently viewed */}
        <RecentlyViewed />
      </div>
    </div>
  );
}
