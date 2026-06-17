"use client";

import { useState, useEffect, useRef } from "react";

import { Calculator, CreditCard, ChevronDown, Loader2, CheckCircle, Send, Zap, Fuel, Leaf, Plug, AlertTriangle, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/shared/section-heading";
import { FinancingCalculator } from "@/components/calculator/financing-calculator";
import { Turnstile } from "@/components/shared/turnstile";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";
import {
  computeCustomsUz, resolveVehicleKind, resolveVehicleAge,
  type VehicleKind, type VehicleAge, type OriginClass, type CustomsResult,
} from "@/lib/customs-uz";
import { formatPrice, cn } from "@/lib/utils";

type Tri = Record<Locale, string>;
const KINDS: { value: VehicleKind; icon: React.ComponentType<{ className?: string }>; label: Tri }[] = [
  { value: "electric", icon: Zap, label: { ru: "Электро", uz: "Elektro", en: "Electric" } },
  { value: "petrol", icon: Fuel, label: { ru: "Бензин / Дизель", uz: "Benzin / Dizel", en: "Petrol / Diesel" } },
  { value: "hybrid", icon: Leaf, label: { ru: "Гибрид", uz: "Gibrid", en: "Hybrid" } },
  { value: "phev", icon: Plug, label: { ru: "Послед. гибрид", uz: "Ketma-ket gibrid", en: "Plug-in / REEV" } },
];
const AGES: { value: VehicleAge; label: Tri }[] = [
  { value: "new", label: { ru: "До 1 года", uz: "1 yilgacha", en: "≤1 year" } },
  { value: "used1to3", label: { ru: "1–3 года", uz: "1–3 yil", en: "1–3 years" } },
  { value: "used3plus", label: { ru: "Более 3 лет", uz: "3 yildan ortiq", en: ">3 years" } },
];
const ORIGINS: { value: OriginClass; label: Tri; hint: Tri }[] = [
  { value: "fta", label: { ru: "СНГ / ЕАЭС", uz: "MDH / EOII", en: "CIS / EAEU" }, hint: { ru: "0% пошлины (с сертификатом СТ-1)", uz: "0% boj (ST-1 sertifikati bilan)", en: "0% duty (with ST-1 certificate)" } },
  { value: "certified", label: { ru: "С сертификатом", uz: "Sertifikat bilan", en: "With certificate" } , hint: { ru: "Стандартная пошлина", uz: "Standart boj", en: "Standard duty" } },
  { value: "uncertified", label: { ru: "Без сертификата", uz: "Sertifikatsiz", en: "No certificate" }, hint: { ru: "⚠️ Пошлина ×2 (страна происхождения неизвестна)", uz: "⚠️ Boj ×2 (kelib chiqishi noma'lum)", en: "⚠️ Duty ×2 (origin unknown)" } },
];
const LINE_LABEL: Record<CustomsResult["lines"][number]["key"], Tri> = {
  duty: { ru: "Таможенная пошлина", uz: "Bojxona boji", en: "Customs duty" },
  vat: { ru: "НДС", uz: "QQS", en: "VAT" },
  util: { ru: "Утилизационный сбор", uz: "Utilizatsiya yig'imi", en: "Utilization fee" },
  clearance: { ru: "Таможенный сбор", uz: "Bojxona yig'imi", en: "Clearance fee" },
};
const needsEngine = (k: VehicleKind) => k === "petrol" || k === "diesel" || k === "hybrid";
const uiKind = (k: VehicleKind): VehicleKind => (k === "diesel" ? "petrol" : k);

interface CarOption {
  id: string; brand: string; model: string; year: number;
  price_usd: number; engine_volume: number | null; fuel_type: string;
}

export default function CalculatorContent({ usdUzs }: { usdUzs?: number }) {
  const { locale, dictionary } = useLocale();
  const [activeTab, setActiveTab] = useState<"import" | "financing">("import");
  const [kind, setKind] = useState<VehicleKind>("electric");
  const [age, setAge] = useState<VehicleAge>("new");
  const [origin, setOrigin] = useState<OriginClass>("certified");
  const [carPrice, setCarPrice] = useState("");
  const [engineL, setEngineL] = useState("2.0");
  const [delivery, setDelivery] = useState("");
  const [result, setResult] = useState<CustomsResult | null>(null);
  const [calculated, setCalculated] = useState(false);
  const [catalogCars, setCatalogCars] = useState<CarOption[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string>("");
  const resultRef = useRef<HTMLDivElement>(null);

  const [lead, setLead] = useState({ name: "", phone: "" });
  const [leadToken, setLeadToken] = useState<string | null>(null);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);

  const t = {
    engine: locale === "ru" ? "Объём двигателя (л)" : locale === "uz" ? "Dvigatel hajmi (l)" : "Engine volume (L)",
    delivery: locale === "ru" ? "Доставка (USD, необяз.)" : locale === "uz" ? "Yetkazib berish (USD, ixtiyoriy)" : "Delivery (USD, optional)",
    vehicleType: locale === "ru" ? "Тип авто" : locale === "uz" ? "Avto turi" : "Vehicle type",
    ageLabel: locale === "ru" ? "Возраст авто" : locale === "uz" ? "Avto yoshi" : "Vehicle age",
    originLabel: locale === "ru" ? "Происхождение / сертификат" : locale === "uz" ? "Kelib chiqishi / sertifikat" : "Origin / certificate",
    customsCost: locale === "ru" ? "Стоимость растаможки" : locale === "uz" ? "Rastamojka narxi" : "Customs total",
    grandTotal: locale === "ru" ? "Итого под ключ" : locale === "uz" ? "Hammasi, под ключ" : "All-in total",
    carPriceRow: locale === "ru" ? "Стоимость авто" : locale === "uz" ? "Avto narxi" : "Car price",
    note: locale === "ru"
      ? "* Расчёт по тарифам РУз (тип, возраст, объём, происхождение). Сертификация ~$300–690 — отдельно. Точную сумму подтвердит брокер."
      : locale === "uz"
      ? "* OʻzR tariflari boʻyicha (turi, yoshi, hajmi, kelib chiqishi). Sertifikatlash ~$300–690 — alohida. Aniq summani broker tasdiqlaydi."
      : "* Per Uzbekistan tariffs (type, age, engine, origin). Certification ~$300–690 is separate. A broker confirms the exact figure.",
    leadTitle: locale === "ru" ? "Получить точный расчёт" : locale === "uz" ? "Aniq hisobni olish" : "Get an exact quote",
    leadSubtitle: locale === "ru" ? "Оставьте контакты — менеджер пришлёт официальный расчёт и поможет с импортом под ключ." : locale === "uz" ? "Kontakt qoldiring — menejer rasmiy hisobni yuboradi va importda yordam beradi." : "Leave your contact and a manager will send the official quote and handle the import for you.",
    leadCta: locale === "ru" ? "Получить расчёт" : locale === "uz" ? "Hisobni olish" : "Get my quote",
    leadSuccess: locale === "ru" ? "Заявка отправлена! Менеджер свяжется с вами." : locale === "uz" ? "Ariza yuborildi! Menejer siz bilan bog'lanadi." : "Request sent! A manager will contact you shortly.",
    leadErr: locale === "ru" ? "Не удалось отправить. Попробуйте ещё раз." : locale === "uz" ? "Yuborilmadi. Qayta urinib ko'ring." : "Could not send. Please try again.",
    sum: locale === "ru" ? "сум" : locale === "uz" ? "so'm" : "UZS",
  };
  const fmtSum = (n: number) => `${n.toLocaleString("ru-RU")} ${t.sum}`;

  useEffect(() => {
    fetch("/api/cars").then((r) => r.json()).then((d) => setCatalogCars(d.cars || [])).catch(() => {});
  }, []);

  // Deep-link prefill (/calculator?car=<id>).
  useEffect(() => {
    if (catalogCars.length === 0) return;
    const carId = new URLSearchParams(window.location.search).get("car");
    if (!carId) return;
    const car = catalogCars.find((c) => c.id === carId);
    if (!car) return;
    setSelectedCarId(carId);
    setCarPrice(String(car.price_usd));
    setKind(uiKind(resolveVehicleKind(car.fuel_type)));
    setAge(resolveVehicleAge(car.year));
    if (car.engine_volume) setEngineL(String(car.engine_volume));
  }, [catalogCars]);

  // Live recompute once calculated (instant feedback as inputs change).
  useEffect(() => {
    if (!calculated) return;
    const price = parseFloat(carPrice);
    if (isNaN(price) || price <= 0) { setResult(null); return; }
    setResult(computeCustomsUz({
      priceUsd: price, kind, age, origin,
      engineCc: needsEngine(kind) ? Math.round((parseFloat(engineL) || 0) * 1000) : 0,
      deliveryUsd: parseFloat(delivery) || 0, usdUzs,
    }));
  }, [calculated, kind, age, origin, carPrice, engineL, delivery, usdUzs]);

  const handleCarSelect = (carId: string) => {
    setSelectedCarId(carId);
    if (!carId) return;
    const car = catalogCars.find((c) => c.id === carId);
    if (car) {
      setCarPrice(String(car.price_usd));
      setKind(uiKind(resolveVehicleKind(car.fuel_type)));
      setAge(resolveVehicleAge(car.year));
      if (car.engine_volume) setEngineL(String(car.engine_volume));
      setLeadSuccess(false);
    }
  };

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(carPrice);
    if (isNaN(price) || price <= 0) return;
    setCalculated(true);
    setLeadSuccess(false);
    setLeadError(null);
    setTimeout(() => {
      if (typeof window !== "undefined" && window.innerWidth < 1024) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result) return;
    setLeadSubmitting(true);
    setLeadError(null);
    const selectedCar = catalogCars.find((c) => c.id === selectedCarId);
    const carLabel = selectedCar ? `${selectedCar.brand} ${selectedCar.model} ${selectedCar.year}` : `${KINDS.find((k) => k.value === kind)?.label[locale]}, ${formatPrice(result.customsValueUsd)}`;
    const message = `${dictionary.calculator.title}: ${carLabel}. ${t.customsCost}: ${formatPrice(result.customsCostUsd)}, ${t.grandTotal}: ${formatPrice(result.totalUsd)}.`;
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: lead.name, phone: lead.phone, type: "calculator", source_page: "calculator",
          car_id: selectedCar?.id || undefined, message,
          metadata: {
            car: carLabel, vehicle_kind: kind, age, origin,
            engine_l: needsEngine(kind) ? engineL : undefined,
            car_price_usd: result.customsValueUsd, customs_cost_usd: result.customsCostUsd, total_usd: result.totalUsd,
            breakdown: result.lines.map((l) => ({ key: l.key, usd: l.usdValue, sum: l.sumValue })),
          },
          turnstile_token: leadToken ?? undefined,
        }),
      });
      if (res.ok) { setLeadSuccess(true); setLead({ name: "", phone: "" }); }
      else setLeadError(t.leadErr);
    } catch { setLeadError(t.leadErr); }
    finally { setLeadSubmitting(false); }
  };

  const segBtn = (active: boolean) => cn(
    "px-3 py-2.5 rounded-xl text-xs font-medium border transition-all text-center",
    active ? "bg-primary/15 border-primary text-primary" : "border-border text-muted-foreground hover:bg-muted/40",
  );

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading as="h1" title={dictionary.calculator.title} subtitle={dictionary.calculator.subtitle} />

        <div className="max-w-4xl mx-auto flex gap-2 mb-8">
          <button onClick={() => setActiveTab("import")} className={cn("flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all", activeTab === "import" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "bg-card text-muted-foreground hover:bg-muted/40 border border-border")}>
            <Calculator className="w-4 h-4" />{locale === "ru" ? "Растаможка" : locale === "uz" ? "Rastamojka" : "Customs"}
          </button>
          <button onClick={() => setActiveTab("financing")} className={cn("flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all", activeTab === "financing" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "bg-card text-muted-foreground hover:bg-muted/40 border border-border")}>
            <CreditCard className="w-4 h-4" />{locale === "ru" ? "Рассрочка" : locale === "uz" ? "Bo'lib to'lash" : "Financing"}
          </button>
        </div>

        {activeTab === "financing" ? (
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8"><FinancingCalculator /></div>
        ) : (
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="animate-fade-in-up">
              <form onSubmit={handleCalculate} className="bg-card rounded-2xl border border-border p-8 space-y-6">
                {/* Vehicle type */}
                <div>
                  <label className="text-sm font-semibold mb-3 block text-foreground">{t.vehicleType}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {KINDS.map((k) => { const Icon = k.icon; return (
                      <button key={k.value} type="button" onClick={() => setKind(k.value)} className={cn("flex flex-col items-center gap-1 px-2 py-3 rounded-xl text-xs font-medium border transition-all text-center", kind === k.value ? "bg-primary/15 border-primary text-primary" : "border-border text-muted-foreground hover:bg-muted/40")}>
                        <Icon className="w-4 h-4" />{k.label[locale]}
                      </button>); })}
                  </div>
                </div>

                {/* Age */}
                <div>
                  <label className="text-sm font-semibold mb-3 block text-foreground">{t.ageLabel}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {AGES.map((a) => (<button key={a.value} type="button" onClick={() => setAge(a.value)} className={segBtn(age === a.value)}>{a.label[locale]}</button>))}
                  </div>
                </div>

                {/* Origin / certificate */}
                <div>
                  <label className="text-sm font-semibold mb-3 block text-foreground">{t.originLabel}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ORIGINS.map((o) => (<button key={o.value} type="button" onClick={() => setOrigin(o.value)} className={segBtn(origin === o.value)}>{o.label[locale]}</button>))}
                  </div>
                  <p className={cn("mt-2 text-xs flex items-center gap-1.5", origin === "uncertified" ? "text-[var(--warning,#d97706)]" : "text-muted-foreground")}>
                    {origin === "uncertified" ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <BadgeCheck className="w-3.5 h-3.5 shrink-0 text-[var(--success,#16a34a)]" />}
                    {ORIGINS.find((o) => o.value === origin)?.hint[locale]}
                  </p>
                </div>

                {catalogCars.length > 0 && (
                  <div>
                    <label className="text-sm font-semibold mb-2 block text-foreground">{locale === "ru" ? "Выбрать из каталога" : locale === "uz" ? "Katalogdan tanlash" : "Choose from Catalog"}</label>
                    <div className="relative">
                      <select value={selectedCarId} onChange={(e) => handleCarSelect(e.target.value)} className="w-full h-12 rounded-xl border border-border bg-background text-foreground px-4 pr-10 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer">
                        <option value="">{locale === "ru" ? "— Или введите вручную —" : locale === "uz" ? "— Yoki qo'lda kiriting —" : "— Or enter manually —"}</option>
                        {catalogCars.map((car) => (<option key={car.id} value={car.id}>{car.brand} {car.model} {car.year} — ${car.price_usd.toLocaleString()}</option>))}
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
                  <Calculator className="w-5 h-5" />{dictionary.calculator.calculate}
                </Button>
              </form>
            </div>

            <div ref={resultRef} className="animate-fade-in-up scroll-mt-24" style={{ animationDelay: "100ms" }}>
              {result ? (
                <div className="space-y-4">
                  <div className="bg-card rounded-2xl border border-border overflow-hidden">
                    <div className="p-6 border-b border-border"><h3 className="text-lg font-bold text-foreground">{dictionary.calculator.result.title}</h3></div>
                    <div className="p-6 space-y-3">
                      <div className="flex items-center justify-between py-2 border-b border-border">
                        <span className="text-sm text-muted-foreground">{t.carPriceRow}</span>
                        <span className="text-sm font-semibold text-foreground">{formatPrice(result.customsValueUsd)}</span>
                      </div>
                      {result.lines.map((l) => (
                        <div key={l.key} className="flex items-start justify-between py-2 border-b border-border last:border-0 gap-3">
                          <span className="text-sm text-muted-foreground">{LINE_LABEL[l.key][locale]}{l.detail && <span className="text-xs opacity-60"> · {l.detail}</span>}</span>
                          <span className="text-sm font-semibold text-foreground text-right whitespace-nowrap">
                            {formatPrice(l.usdValue)}
                            {l.sumValue ? <span className="block text-[11px] font-normal text-muted-foreground">{fmtSum(l.sumValue)}</span> : null}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-muted/40 p-6 border-t border-border space-y-2">
                      <div className="flex items-center justify-between"><span className="text-sm font-semibold text-muted-foreground">{t.customsCost}</span><span className="text-lg font-bold text-foreground">{formatPrice(result.customsCostUsd)}</span></div>
                      <div className="flex items-center justify-between pt-2 border-t border-border"><span className="font-bold text-base text-foreground">{t.grandTotal}</span><span className="text-2xl font-bold text-primary">{formatPrice(result.totalUsd)}</span></div>
                    </div>
                    <div className="p-4 text-xs text-muted-foreground text-center">{t.note}</div>
                  </div>

                  <div className="bg-card rounded-2xl border border-primary/30 p-6">
                    {leadSuccess ? (
                      <div className="text-center py-4"><CheckCircle className="w-12 h-12 text-neon-green mx-auto mb-3" /><p className="text-foreground font-semibold">{t.leadSuccess}</p></div>
                    ) : (
                      <form onSubmit={handleLeadSubmit} className="space-y-4">
                        <div><h4 className="text-base font-bold text-foreground">{t.leadTitle}</h4><p className="text-xs text-muted-foreground mt-1">{t.leadSubtitle}</p></div>
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
                  <div><Calculator className="w-16 h-16 text-foreground/20 mx-auto mb-4" /><p className="text-muted-foreground">{dictionary.calculator.subtitle}</p></div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
