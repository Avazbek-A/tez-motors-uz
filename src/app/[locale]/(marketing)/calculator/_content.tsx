"use client";

import { useState, useEffect } from "react";

import { Calculator, CreditCard, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/shared/section-heading";
import { FinancingCalculator } from "@/components/calculator/financing-calculator";
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

interface CarOption {
  id: string;
  brand: string;
  model: string;
  year: number;
  price_usd: number;
  engine_volume: number | null;
  fuel_type: string;
}

export default function CalculatorContent() {
  const { locale, dictionary } = useLocale();
  const [activeTab, setActiveTab] = useState<"import" | "financing">("import");
  const [carPrice, setCarPrice] = useState("");
  const [engineVolume, setEngineVolume] = useState("1.5");
  const [fuelType, setFuelType] = useState("petrol");
  const [year, setYear] = useState("2024");
  const [result, setResult] = useState<CalcResult | null>(null);
  const [catalogCars, setCatalogCars] = useState<CarOption[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string>("");

  useEffect(() => {
    fetch("/api/cars")
      .then((r) => r.json())
      .then((data) => setCatalogCars(data.cars || []))
      .catch(() => {});
  }, []);

  const handleCarSelect = (carId: string) => {
    setSelectedCarId(carId);
    if (!carId) return;
    const car = catalogCars.find((c) => c.id === carId);
    if (car) {
      setCarPrice(String(car.price_usd));
      setEngineVolume(car.engine_volume ? String(car.engine_volume) : "0");
      setFuelType(car.fuel_type || "petrol");
      setYear(String(car.year));
      setResult(null);
    }
  };

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

        {/* Tab switcher */}
        <div className="max-w-4xl mx-auto flex gap-2 mb-8">
          <button
            onClick={() => setActiveTab("import")}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all",
              activeTab === "import" ? "bg-neon-blue text-white shadow-lg shadow-neon-blue/25" : "bg-[#0a0a0f] text-white/60 hover:bg-white/5"
            )}
          >
            <Calculator className="w-4 h-4" />
            {locale === "ru" ? "Импорт" : locale === "uz" ? "Import" : "Import Cost"}
          </button>
          <button
            onClick={() => setActiveTab("financing")}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all",
              activeTab === "financing" ? "bg-neon-blue text-white shadow-lg shadow-neon-blue/25" : "bg-[#0a0a0f] text-white/60 hover:bg-white/5"
            )}
          >
            <CreditCard className="w-4 h-4" />
            {locale === "ru" ? "Рассрочка" : locale === "uz" ? "Bo'lib to'lash" : "Financing"}
          </button>
        </div>

        {activeTab === "financing" ? (
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
            <FinancingCalculator />
          </div>
        ) : (
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form */}
          <div
            className="animate-fade-in-up"
          >
            <form onSubmit={handleCalculate} className="bg-[#0d0d15] rounded-2xl border border-white/10 p-8 space-y-6">
              {/* Car picker from catalog */}
              {catalogCars.length > 0 && (
                <div>
                  <label className="text-sm font-semibold mb-2 block">
                    {locale === "ru" ? "Выбрать из каталога" : locale === "uz" ? "Katalogdan tanlash" : "Choose from Catalog"}
                  </label>
                  <div className="relative">
                    <select
                      value={selectedCarId}
                      onChange={(e) => handleCarSelect(e.target.value)}
                      className="w-full h-12 rounded-xl border border-white/10 bg-[#0a0a0f] text-white px-4 pr-10 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-neon-blue cursor-pointer"
                    >
                      <option value="">
                        {locale === "ru" ? "— Или введите вручную —" : locale === "uz" ? "— Yoki qo'lda kiriting —" : "— Or enter manually —"}
                      </option>
                      {catalogCars.map((car) => (
                        <option key={car.id} value={car.id}>
                          {car.brand} {car.model} {car.year} — ${car.price_usd.toLocaleString()}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                  </div>
                </div>
              )}

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
                          ? "bg-neon-blue/15 border-neon-blue text-neon-blue"
                          : "border-white/10 text-white/60 hover:bg-white/5"
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
              <div className="bg-[#0d0d15] rounded-2xl border border-white/10 overflow-hidden">
                <div className="bg-[#0a0a0f] text-white p-6">
                  <h3 className="text-lg font-bold">{dictionary.calculator.result.title}</h3>
                </div>
                <div className="p-6 space-y-3">
                  {resultRows.map((row, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
                      <span className="text-sm text-white/60">{row.label}</span>
                      <span className="text-sm font-semibold text-white">{formatPrice(row.value)}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-neon-blue/10 p-6 border-t-2 border-neon-blue">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg text-white">{dictionary.calculator.result.total}</span>
                    <span className="text-2xl font-bold text-neon-blue">{formatPrice(result.total)}</span>
                  </div>
                </div>
                <div className="p-4 text-xs text-white/60 text-center">
                  {dictionary.calculator.result.note}
                </div>
              </div>
            ) : (
              <div className="bg-[#0a0a0f] rounded-2xl border border-white/10 border-dashed h-full flex items-center justify-center p-12 text-center">
                <div>
                  <Calculator className="w-16 h-16 text-white/20 mx-auto mb-4" />
                  <p className="text-white/60">{dictionary.calculator.subtitle}</p>
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
