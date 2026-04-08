"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Currency = "USD" | "UZS";

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  convert: (usd: number) => number;
  format: (usd: number) => string;
}

const UZS_RATE = 12600; // 1 USD = ~12,600 UZS (approximate)

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>("USD");

  const convert = (usd: number) => currency === "UZS" ? usd * UZS_RATE : usd;
  const format = (usd: number) => {
    const value = convert(usd);
    if (currency === "UZS") {
      return new Intl.NumberFormat("uz-UZ", {
        style: "currency",
        currency: "UZS",
        maximumFractionDigits: 0,
      }).format(value);
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, convert, format }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}

export function CurrencyToggle({ className }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();

  return (
    <div className={cn("flex items-center gap-0.5 rounded-lg overflow-hidden border border-border bg-white", className)}>
      <button
        onClick={() => setCurrency("USD")}
        className={cn(
          "px-3 py-1.5 text-xs font-semibold transition-all",
          currency === "USD" ? "bg-navy text-white" : "text-muted-foreground hover:text-foreground"
        )}
      >
        USD
      </button>
      <button
        onClick={() => setCurrency("UZS")}
        className={cn(
          "px-3 py-1.5 text-xs font-semibold transition-all",
          currency === "UZS" ? "bg-navy text-white" : "text-muted-foreground hover:text-foreground"
        )}
      >
        UZS
      </button>
    </div>
  );
}
