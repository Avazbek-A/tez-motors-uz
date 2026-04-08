"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Search, CarFront, X } from "lucide-react";
import { MOCK_CARS } from "@/lib/mock-data";
import { formatPrice, cn } from "@/lib/utils";

interface SearchAutocompleteProps {
  placeholder?: string;
  className?: string;
  onSelect?: () => void;
}

export function SearchAutocomplete({ placeholder = "Search cars...", className, onSelect }: SearchAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const results = query.length >= 2
    ? MOCK_CARS.filter((car) => {
        const q = query.toLowerCase();
        return (
          `${car.brand} ${car.model}`.toLowerCase().includes(q) ||
          car.brand.toLowerCase().includes(q) ||
          car.model.toLowerCase().includes(q)
        );
      }).slice(0, 6)
    : [];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(e.target.value.length >= 2);
          }}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full h-10 pl-10 pr-8 rounded-xl border border-border bg-white text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-lime focus:border-transparent transition-all"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setIsOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-xl border border-border shadow-xl z-50 overflow-hidden animate-fade-in">
          {results.map((car) => (
            <Link
              key={car.id}
              href={`/catalog/${car.slug}`}
              onClick={() => {
                setQuery("");
                setIsOpen(false);
                onSelect?.();
              }}
              className="flex items-center gap-3 p-3 hover:bg-muted transition-colors border-b border-border last:border-0"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-navy/5 to-lime/5 flex items-center justify-center shrink-0">
                <CarFront className="w-5 h-5 text-navy/20" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{car.brand} {car.model}</p>
                <p className="text-xs text-muted-foreground">{car.year} &middot; {car.fuel_type}</p>
              </div>
              <p className="text-sm font-semibold text-navy shrink-0">{formatPrice(car.price_usd)}</p>
            </Link>
          ))}
          <Link
            href={`/catalog?search=${encodeURIComponent(query)}`}
            onClick={() => { setQuery(""); setIsOpen(false); onSelect?.(); }}
            className="block p-3 text-center text-sm text-lime-dark hover:bg-muted transition-colors font-medium"
          >
            View all results for &ldquo;{query}&rdquo;
          </Link>
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-xl border border-border shadow-xl z-50 p-6 text-center animate-fade-in">
          <p className="text-sm text-muted-foreground">No cars found for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
