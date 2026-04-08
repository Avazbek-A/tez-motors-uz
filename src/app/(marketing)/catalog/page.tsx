"use client";

import { useState, useMemo } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CarCard } from "@/components/catalog/car-card";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { MOCK_CARS } from "@/lib/mock-data";
import { CAR_BRANDS, BODY_TYPES, FUEL_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { CarFilters } from "@/types/car";

export default function CatalogPage() {
  const { locale, dictionary } = useLocale();
  const [filters, setFilters] = useState<CarFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const filteredCars = useMemo(() => {
    return MOCK_CARS.filter((car) => {
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
  }, [filters]);

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
          <p className="text-sm text-muted-foreground">
            {filteredCars.length} {dictionary.catalog.filters.results}
          </p>
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
      </div>
    </div>
  );
}
