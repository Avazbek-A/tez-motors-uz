"use client";

import { useState } from "react";

import { Calculator, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { FUEL_TYPES } from "@/lib/constants";
import { formatPrice, cn } from "@/lib/utils";

interface CalcResult {
  carPrice: number;
  customsDuty: number;
  exciseTax: number;
  vat: number;
  delivery: number;
  serviceFee: number;
  total: number;
}

function calculateImportCost(
  carPrice: number,
  engineVolume: number,
  fuelType: string,
  year: number
): CalcResult {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;

  // Customs duty: depends on engine volume and age
  let dutyRate = 0.15; // 15% base
  if (age > 3) dutyRate = 0.25;
  if (age > 7) dutyRate = 0.35;
  if (fuelType === "electric") dutyRate = 0.05; // EV incentive

  const customsDuty = Math.round(carPrice * dutyRate);

  // Excise tax: based on engine volume
  let excisePerCC = 0;
  if (fuelType !== "electric") {
    if (engineVolume <= 1.5) excisePerCC = 0.5;
    else if (engineVolume <= 2.0) excisePerCC = 1.0;
    else if (engineVolume <= 3.0) excisePerCC = 2.0;
    else excisePerCC = 3.5;
  }
  const exciseTax = Math.round(engineVolume * 1000 * excisePerCC);

  // VAT: 12% of (car price + customs duty + excise)
  const vatBase = carPrice + customsDuty + exciseTax;
  const vat = Math.round(vatBase * 0.12);

  // Delivery: flat estimate
  const delivery = fuelType === "electric" ? 3000 : 2500;

  // Service fee
  const serviceFee = Math.max(1500, Math.round(carPrice * 0.05));

  const total = carPrice + customsDuty + exciseTax + vat + delivery + serviceFee;

  return { carPrice, customsDuty, exciseTax, vat, delivery, serviceFee, total };
}

export default function CalculatorPage() {
  const { locale, dictionary } = useLocale();
  const [carPrice, setCarPrice] = useState("");
  const [engineVolume, setEngineVolume] = useState("1.5");
  const [fuelType, setFuelType] = useState("petrol");
  const [year, setYear] = useState("2024");
  const [result, setResult] = useState<CalcResult | null>(null);

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(carPrice);
    if (isNaN(price) || price <= 0) return;

    const res = calculateImportCost(
      price,
      parseFloat(engineVolume) || 0,
      fuelType,
      parseInt(year) || 2024
    );
    setResult(res);
  };

  const resultRows = result
    ? [
        { label: dictionary.calculator.result.carPrice, value: result.carPrice },
        { label: dictionary.calculator.result.customsDuty, value: result.customsDuty },
        { label: dictionary.calculator.result.exciseTax, value: result.exciseTax },
        { label: dictionary.calculator.result.vat, value: result.vat },
        { label: dictionary.calculator.result.delivery, value: result.delivery },
        { label: dictionary.calculator.result.serviceFee, value: result.serviceFee },
      ]
    : [];

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading
          title={dictionary.calculator.title}
          subtitle={dictionary.calculator.subtitle}
        />

        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form */}
          <div
            className="animate-fade-in-up"
          >
            <form onSubmit={handleCalculate} className="bg-white rounded-2xl border border-border p-8 space-y-6">
              <div>
                <label className="text-sm font-semibold mb-2 block">{dictionary.calculator.carPrice}</label>
                <Input
                  type="number"
                  placeholder="25000"
                  value={carPrice}
                  onChange={(e) => setCarPrice(e.target.value)}
                  required
                  min="1000"
                  className="h-14 text-lg"
                />
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">{dictionary.calculator.engineVolume}</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="1.5"
                  value={engineVolume}
                  onChange={(e) => setEngineVolume(e.target.value)}
                  min="0"
                  max="8"
                  disabled={fuelType === "electric"}
                  className="h-14 text-lg"
                />
              </div>

              <div>
                <label className="text-sm font-semibold mb-3 block">{dictionary.calculator.fuelType}</label>
                <div className="grid grid-cols-2 gap-2">
                  {FUEL_TYPES.map((ft) => (
                    <button
                      key={ft.value}
                      type="button"
                      onClick={() => {
                        setFuelType(ft.value);
                        if (ft.value === "electric") setEngineVolume("0");
                      }}
                      className={cn(
                        "px-4 py-3 rounded-xl text-sm font-medium border transition-all",
                        fuelType === ft.value
                          ? "bg-lime/15 border-lime text-lime-dark"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {ft.label[locale]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">{dictionary.calculator.year}</label>
                <Input
                  type="number"
                  placeholder="2024"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  min="2010"
                  max="2026"
                  className="h-14 text-lg"
                />
              </div>

              <Button type="submit" size="xl" className="w-full">
                <Calculator className="w-5 h-5" />
                {dictionary.calculator.calculate}
              </Button>
            </form>
          </div>

          {/* Result */}
          <div
            className="animate-fade-in-up"
            style={{ animationDelay: "100ms" }}
          >
            {result ? (
              <div className="bg-white rounded-2xl border border-border overflow-hidden">
                <div className="bg-navy text-white p-6">
                  <h3 className="text-lg font-bold">{dictionary.calculator.result.title}</h3>
                </div>
                <div className="p-6 space-y-3">
                  {resultRows.map((row, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="text-sm text-muted-foreground">{row.label}</span>
                      <span className="text-sm font-semibold">{formatPrice(row.value)}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-lime/10 p-6 border-t-2 border-lime">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg">{dictionary.calculator.result.total}</span>
                    <span className="text-2xl font-bold text-navy">{formatPrice(result.total)}</span>
                  </div>
                </div>
                <div className="p-4 text-xs text-muted-foreground text-center">
                  {dictionary.calculator.result.note}
                </div>
              </div>
            ) : (
              <div className="bg-muted/50 rounded-2xl border border-border border-dashed h-full flex items-center justify-center p-12 text-center">
                <div>
                  <Calculator className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">{dictionary.calculator.subtitle}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
