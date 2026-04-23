"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, CarFront, X, Loader2 } from "lucide-react";
import { formatPrice, cn } from "@/lib/utils";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";
import type { Car } from "@/types/car";

interface SearchAutocompleteProps {
  placeholder?: string;
  className?: string;
  onSelect?: () => void;
}

export function SearchAutocomplete({ placeholder = "Search cars...", className, onSelect }: SearchAutocompleteProps) {
  const { locale } = useLocale();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<Car[]>([]);
  const [searching, setSearching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const doSearch = useCallback((q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setSearching(true);
    fetch(`/api/cars?search=${encodeURIComponent(q)}&limit=6`)
      .then((r) => r.json())
      .then((data) => {
        setResults(data.cars || []);
        setIsOpen(true);
        setSearching(false);
      })
      .catch(() => setSearching(false));
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

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
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full h-10 pl-10 pr-8 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-neon-blue/50 focus:border-neon-blue/50 transition-all"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setIsOpen(false); setResults([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-[#0d0d15] rounded-xl border border-neon-blue/20 shadow-[0_0_20px_rgba(0,212,255,0.1)] z-50 overflow-hidden animate-fade-in">
          {results.map((car) => (
            <Link
              key={car.id}
              href={localizedPath(locale, `/catalog/${car.slug}`)}
              onClick={() => {
                setQuery("");
                setIsOpen(false);
                setResults([]);
                onSelect?.();
              }}
              className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
            >
              <div className="w-10 h-10 rounded-lg bg-neon-blue/5 border border-neon-blue/10 flex items-center justify-center shrink-0">
                <CarFront className="w-5 h-5 text-neon-blue/30" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{car.brand} {car.model}</p>
                <p className="text-xs text-white/60">{car.year} &middot; {car.fuel_type}</p>
              </div>
              <p className="text-sm font-semibold text-neon-blue shrink-0">{formatPrice(car.price_usd)}</p>
            </Link>
          ))}
          <Link
            href={localizedPath(locale, `/catalog?search=${encodeURIComponent(query)}`)}
            onClick={() => { setQuery(""); setIsOpen(false); setResults([]); onSelect?.(); }}
            className="block p-3 text-center text-sm text-neon-blue hover:bg-white/5 transition-colors font-medium"
          >
            View all results for &ldquo;{query}&rdquo;
          </Link>
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && !searching && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-[#0d0d15] rounded-xl border border-neon-blue/20 shadow-[0_0_20px_rgba(0,212,255,0.1)] z-50 p-6 text-center animate-fade-in">
          <p className="text-sm text-white/60">No cars found for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
