"use client";

import { useState, useEffect } from "react";

import { Calculator, CreditCard, ChevronDown, Loader2, CheckCircle, Send, Zap, Fuel, Leaf, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/shared/section-heading";
import { FinancingCalculator } from "@/components/calculator/financing-calculator";
import { Turnstile } from "@/components/shared/turnstile";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";
import { computeCustomsUz, resolveVehicleKind, type VehicleKind, type CustomsResult } from "@/lib/customs-uz";
import { formatPrice, cn } from "@/lib/utils";

// Vehicle types mirror Gonzo's tabs (Электро / ДВС / Гибрид / Послед. гибрид).
const KINDS: { value: VehicleKind; icon: React.ComponentType<{ className?: string }>; label: Record<Locale, string> }[] = [
  { value: "electric", icon: Zap, label: { ru: "Электро", uz: "Elektro", en: "Electric" } },
  { value: "petrol", icon: Fuel, label: { ru: "Бензин", uz: "Benzin", en: "Petrol" } },
  { value: "diesel", icon: Fuel, label: { ru: "Дизель", uz: "Dizel", en: "Diesel" } },
  { value: "hybrid", icon: Leaf, label: { ru: "Гибрид", uz: "Gibrid", en: "Hybrid" } },
  { value: "phev", icon: Plug, label: { ru: "Послед. гибрид", uz: "Ketma-ket gibrid", en: "Plug-in / REEV" } },
];

const LINE_LABEL: Record<CustomsResult["lines"][number]["key"], Record<Locale, string>> = {
  duty: { ru: "Таможенная пошлина", uz: "Bojxona boji", en: "Customs duty" },
  vat: { ru: "НДС", uz: "QQS", en: "VAT" },
  util: { ru: "Утилизационный сбор", uz: "Utilizatsiya yig'imi", en: "Utilization fee" },
  clearance: { ru: "Таможенный сбор", uz: "Bojxona yig'imi", en: "Clearance fee" },
  certificate: { ru: "Сертификаты + декларация", uz: "Sertifikatlar + deklaratsiya", en: "Certificates + declaration" },
};

const needsEngine = (k: VehicleKind) => k === "petrol" || k === "diesel" || k === "hybrid";

interface CarOption {
  id: string;
  brand: string;
  model: string;
  year: number;
  price_usd: number;
  engine_volume: number | null;
  fuel_type: string;
}

export default function CalculatorContent({ usdUzs }: { usdUzs?: number }) {
  const { locale, dictionary } = useLocale();
  const [activeTab, setActiveTab] = useState<"import" | "financing">("import");
  const [kind, setKind] = useState<VehicleKind>("electric");
  const [carPrice, setCarPrice] = useState("");
  const [engineL, setEngineL] = useState("2.0");
  const [delivery, setDelivery] = useState("");
  const [result, setResult] = useState<CustomsResult | null>(null);
  const [catalogCars, setCatalogCars] = useState<CarOption[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string>("");

  // Lead capture on the computed estimate
  const [lead, setLead] = useState({ name: "", phone: "" });
  const [leadToken, setLeadToken] = useState<string | null>(null);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);

  const t = {
    engine: locale === "ru" ? "Объём двигателя (л)" : locale === "uz" ? "Dvigatel hajmi (l)" : "Engine volume (L)",
    delivery: locale === "ru" ? "Доставка (USD, необяз.)" : locale === "uz" ? "Yetkazib berish (USD, ixtiyoriy)" : "Delivery (USD, optional)",
    vehicleType: locale === "ru" ? "Тип авто" : locale === "uz" ? "Avto turi" : "Vehicle type",
    customsCost: locale === "ru" ? "Стоимость растаможки" : locale === "uz" ? "Rastamojka narxi" : "Customs total",
    grandTotal: locale === "ru" ? "Итого под ключ" : locale === "uz" ? "Hammasi, под ключ" : "All-in total",
    carPriceRow: locale === "ru" ? "Стоимость авто" : locale === "uz" ? "Avto narxi" : "Car price",
    evExempt: locale === "ru" ? "Освобождено от пошлины" : locale === "uz" ? "Bojdan ozod" : "Duty-exempt",
    note: locale === "ru"
      ? "* Приблизительный расчёт по нормам РУз. Точную сумму подтвердит брокер."
      : locale === "uz"
      ? "* Taxminiy hisob (OʻzR normalari). Aniq summani broker tasdiqlaydi."
      : "* Estimate per Uzbekistan customs rules. A broker confirms the exact figure.",
    leadTitle: locale === "ru" ? "Получить точный расчёт" : locale === "uz" ? "Aniq hisobni olish" : "Get an exact quote",
    leadSubtitle:
      locale === "ru" ? "Оставьте контакты — менеджер пришлёт официальный расчёт и поможет с импортом под ключ."
      : locale === "uz" ? "Kontakt qoldiring — menejer rasmiy hisobni yuboradi va importda yordam beradi."
      : "Leave your contact and a manager will send the official quote and handle the import for you.",
    leadCta: locale === "ru" ? "Получить расчёт" : locale === "uz" ? "Hisobni olish" : "Get my quote",
    leadSuccess: locale === "ru" ? "Заявка отправлена! Менеджер свяжется с вами." : locale === "uz" ? "Ariza yuborildi! Menejer siz bilan bog'lanadi." : "Request sent! A manager will contact you shortly.",
    leadErr: locale === "ru" ? "Не удалось отправить. Попробуйте ещё раз." : locale === "uz" ? "Yuborilmadi. Qayta urinib ko'ring." : "Could not send. Please try again.",
    sum: locale === "ru" ? "сум" : locale === "uz" ? "so'm" : "UZS",
  };

  const fmtSum = (n: number) => `${n.toLocaleString("ru-RU")} ${t.sum}`;

  useEffect(() => {
    fetch("/api/cars")
      .then((r) => r.json())
      .then((data) => setCatalogCars(data.cars || []))
      .catch(() => {});
  }, []);

  // Deep-link from a car page (/calculator?car=<id>): prefill price/type/engine
  // once the catalog has loaded, so the estimate is one click from the listing.
  useEffect(() => {
    if (catalogCars.length === 0) return;
    const carId = new URLSearchParams(window.location.search).get("car");
    if (!carId) return;
    const car = catalogCars.find((c) => c.id === carId);
    if (!car) return;
    setSelectedCarId(carId);
    setCarPrice(String(car.price_usd));
    setKind(resolveVehicleKind(car.fuel_type));
    if (car.engine_volume) setEngineL(String(car.engine_volume));
  }, [catalogCars]);

  const handleCarSelect = (carId: string) => {
    setSelectedCarId(carId);
    if (!carId) return;
    const car = catalogCars.find((c) => c.id === carId);
    if (car) {
      setCarPrice(String(car.price_usd));
      setKind(resolveVehicleKind(car.fuel_type));
      if (car.engine_volume) setEngineL(String(car.engine_volume));
      setResult(null);
      setLeadSuccess(false);
    }
  };

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(carPrice);
    if (isNaN(price) || price <= 0) return;
    const res = computeCustomsUz({
      priceUsd: price,
      kind,
      engineCc: needsEngine(kind) ? Math.round((parseFloat(engineL) || 0) * 1000) : 0,
      deliveryUsd: parseFloat(delivery) || 0,
      usdUzs,
    });
    setResult(res);
    setLeadSuccess(false);
    setLeadError(null);
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result) return;
    setLeadSubmitting(true);
    setLeadError(null);

    const selectedCar = catalogCars.find((c) => c.id === selectedCarId);
    const carLabel = selectedCar ? `${selectedCar.brand} ${selectedCar.model} ${selectedCar.year}` : `${KINDS.find((k) => k.value === kind)?.label[locale]}, ${formatPrice(result.customsValueUsd)}`;
    const message =
      `${dictionary.calculator.title}: ${carLabel}. ` +
      `${t.customsCost}: ${formatPrice(result.customsCostUsd)}, ${t.grandTotal}: ${formatPrice(result.totalUsd)}.`;

    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: lead.name,
          phone: lead.phone,
          type: "calculator",
          source_page: "calculator",
          car_id: selectedCar?.id || undefined,
          message,
          metadata: {
            car: carLabel,
            vehicle_kind: kind,
            engine_l: needsEngine(kind) ? engineL : undefined,
            car_price_usd: result.customsValueUsd,
            customs_cost_usd: result.customsCostUsd,
            total_usd: result.totalUsd,
            breakdown: result.lines.map((l) => ({ key: l.key, usd: l.usdValue, sum: l.sumValue })),
          },
          turnstile_token: leadToken ?? undefined,
        }),
      });
      if (res.ok) {
        setLeadSuccess(true);
        setLead({ name: "", phone: "" });
      } else {
        setLeadError(t.leadErr);
      }
    } catch {
      setLeadError(t.leadErr);
    } finally {
      setLeadSubmitting(false);
    }
  };

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading as="h1" title={dictionary.calculator.title} subtitle={dictionary.calculator.subtitle} />

        {/* Tab switcher */}
        <div className="max-w-4xl mx-auto flex gap-2 mb-8">
          <button
            onClick={() => setActiveTab("import")}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all",
              activeTab === "import" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "bg-card text-muted-foreground hover:bg-muted/40 border border-border"
            )}
          >
            <Calculator className="w-4 h-4" />
            {locale === "ru" ? "Растаможка" : locale === "uz" ? "Rastamojka" : "Customs"}
          </button>
          <button
            onClick={() => setActiveTab("financing")}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all",
              activeTab === "financing" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "bg-card text-muted-foreground hover:bg-muted/40 border border-border"
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
            <div className="animate-fade-in-up">
              <form onSubmit={handleCalculate} className="bg-card rounded-2xl border border-border p-8 space-y-6">
                {/* Vehicle type */}
                <div>
                  <label className="text-sm font-semibold mb-3 block text-foreground">{t.vehicleType}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {KINDS.map((k) => {
                      const Icon = k.icon;
                      return (
                        <button
                          key={k.value}
                          type="button"
                          onClick={() => { setKind(k.value); setResult(null); }}
                          className={cn(
                            "flex flex-col items-center gap-1 px-2 py-3 rounded-xl text-xs font-medium border transition-all text-center",
                            kind === k.value ? "bg-primary/15 border-primary text-primary" : "border-border text-muted-foreground hover:bg-muted/40"
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          {k.label[locale]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Car picker from catalog */}
                {catalogCars.length > 0 && (
                  <div>
                    <label className="text-sm font-semibold mb-2 block text-foreground">
                      {locale === "ru" ? "Выбрать из каталога" : locale === "uz" ? "Katalogdan tanlash" : "Choose from Catalog"}
                    </label>
                    <div className="relative">
                      <select
                        value={selectedCarId}
                        onChange={(e) => handleCarSelect(e.target.value)}
                        className="w-full h-12 rounded-xl border border-border bg-background text-foreground px-4 pr-10 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
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
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-semibold mb-2 block text-foreground">{dictionary.calculator.carPrice}</label>
                  <Input type="number" placeholder="25000" value={carPrice} onChange={(e) => setCarPrice(e.target.value)} required min="1000" className="h-14 text-lg" />
                </div>

                {needsEngine(kind) && (
                  <div>
                    <label className="text-sm font-semibold mb-2 block text-foreground">{t.engine}</label>
                    <Input type="number" step="0.1" placeholder="2.0" value={engineL} onChange={(e) => setEngineL(e.target.value)} min="0" max="8" className="h-14 text-lg" />
                  </div>
                )}

                <div>
                  <label className="text-sm font-semibold mb-2 block text-foreground">{t.delivery}</label>
                  <Input type="number" placeholder="2000" value={delivery} onChange={(e) => setDelivery(e.target.value)} min="0" className="h-14 text-lg" />
                </div>

                <Button type="submit" size="xl" className="w-full h-auto min-h-11 whitespace-normal py-2.5 leading-snug text-center">
                  <Calculator className="w-5 h-5" />
                  {dictionary.calculator.calculate}
                </Button>
              </form>
            </div>

            {/* Result */}
            <div className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
              {result ? (
                <div className="space-y-4">
                  <div className="bg-card rounded-2xl border border-border overflow-hidden">
                    <div className="p-6 border-b border-border">
                      <h3 className="text-lg font-bold text-foreground">{dictionary.calculator.result.title}</h3>
                    </div>
                    <div className="p-6 space-y-3">
                      <div className="flex items-center justify-between py-2 border-b border-border">
                        <span className="text-sm text-muted-foreground">{t.carPriceRow}</span>
                        <span className="text-sm font-semibold text-foreground">{formatPrice(result.customsValueUsd)}</span>
                      </div>
                      {result.lines.map((l) => (
                        <div key={l.key} className="flex items-start justify-between py-2 border-b border-border last:border-0 gap-3">
                          <span className="text-sm text-muted-foreground">
                            {LINE_LABEL[l.key][locale]}
                            {l.detail && <span className="text-xs opacity-60"> · {l.detail}</span>}
                          </span>
                          <span className="text-sm font-semibold text-foreground text-right whitespace-nowrap">
                            {formatPrice(l.usdValue)}
                            {l.sumValue ? <span className="block text-[11px] font-normal text-muted-foreground">{fmtSum(l.sumValue)}</span> : null}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-muted/40 p-6 border-t border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-muted-foreground">{t.customsCost}</span>
                        <span className="text-lg font-bold text-foreground">{formatPrice(result.customsCostUsd)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <span className="font-bold text-base text-foreground">{t.grandTotal}</span>
                        <span className="text-2xl font-bold text-primary">{formatPrice(result.totalUsd)}</span>
                      </div>
                    </div>
                    <div className="p-4 text-xs text-muted-foreground text-center">{t.note}</div>
                  </div>

                  {/* Lead capture — turn the estimate into a contact */}
                  <div className="bg-card rounded-2xl border border-primary/30 p-6">
                    {leadSuccess ? (
                      <div className="text-center py-4">
                        <CheckCircle className="w-12 h-12 text-neon-green mx-auto mb-3" />
                        <p className="text-foreground font-semibold">{t.leadSuccess}</p>
                      </div>
                    ) : (
                      <form onSubmit={handleLeadSubmit} className="space-y-4">
                        <div>
                          <h4 className="text-base font-bold text-foreground">{t.leadTitle}</h4>
                          <p className="text-xs text-muted-foreground mt-1">{t.leadSubtitle}</p>
                        </div>
                        <Input placeholder={dictionary.contact.name} value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} required minLength={2} className="h-12" />
                        <Input type="tel" placeholder={dictionary.contact.phone} value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} required className="h-12" />
                        <Turnstile onToken={setLeadToken} />
                        {leadError && <p className="text-sm text-neon-pink">{leadError}</p>}
                        <Button type="submit" size="lg" className="w-full h-auto min-h-11 whitespace-normal py-2.5 leading-snug text-center" disabled={leadSubmitting}>
                          {leadSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" />{t.leadCta}</>}
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-card rounded-2xl border border-border border-dashed h-full flex items-center justify-center p-12 text-center">
                  <div>
                    <Calculator className="w-16 h-16 text-foreground/20 mx-auto mb-4" />
                    <p className="text-muted-foreground">{dictionary.calculator.subtitle}</p>
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
