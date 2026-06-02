"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ship, Loader2, Save, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  computeLandedCost,
  suggestedListPrice,
  marginPctFromPrice,
  FUEL_KINDS,
  DEFAULT_IMPORT_CONFIG,
  type FuelKind,
  type ImportConfig,
  type ImportRates,
  type ImportFees,
} from "@/lib/import-cost";

interface Fx {
  usd_uzs: number;
  cny_uzs: number;
  cny_usd: number;
  updated_at: string | null;
}

const FUEL_LABELS: Record<FuelKind, string> = {
  petrol: "Petrol",
  diesel: "Diesel",
  hybrid: "Hybrid",
  phev: "Plug-in hybrid",
  electric: "Electric",
};

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const uzs = (n: number) => Math.round(n).toLocaleString("en-US") + " so'm";

export default function ImportCalculatorPage() {
  const [config, setConfig] = useState<ImportConfig>(DEFAULT_IMPORT_CONFIG);
  const [fx, setFx] = useState<Fx>({ usd_uzs: 12600, cny_uzs: 1750, cny_usd: 0.1389, updated_at: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Inputs
  const [supplierPrice, setSupplierPrice] = useState(120000);
  const [currency, setCurrency] = useState<"CNY" | "USD">("CNY");
  const [fuel, setFuel] = useState<FuelKind>("electric");
  const [rates, setRates] = useState<ImportRates>(DEFAULT_IMPORT_CONFIG.rates.electric);
  const [fees, setFees] = useState<ImportFees>(DEFAULT_IMPORT_CONFIG.fees);
  const [margin, setMargin] = useState(DEFAULT_IMPORT_CONFIG.targetMarginPct);
  const [listPrice, setListPrice] = useState(0); // for margin-on-actual-price

  // For optional "save to car" wiring (?car_id=&car_label=)
  const [carId, setCarId] = useState<string | null>(null);
  const [carLabel, setCarLabel] = useState<string>("");
  // Optional market-price prefill from the Market page (?market=&brand=&model=&year=)
  const [marketLabel, setMarketLabel] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/import-config");
      const data = await res.json();
      if (data.config) {
        setConfig(data.config);
        setFees(data.config.fees);
        setMargin(data.config.targetMarginPct);
        setRates(data.config.rates[fuel] ?? data.config.rates.electric);
      }
      if (data.fx) setFx(data.fx);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const id = p.get("car_id");
    if (id) {
      setCarId(id);
      setCarLabel(p.get("car_label") || "this car");
    }
    const market = p.get("market");
    if (market && Number(market) > 0) {
      setListPrice(Number(market));
      const label = [p.get("brand"), p.get("model"), p.get("year")].filter(Boolean).join(" ");
      setMarketLabel(label ? `${label} · market median $${Number(market).toLocaleString("en-US")}` : "");
    }
  }, []);

  // Switching fuel resets the working rates to that fuel's saved defaults.
  useEffect(() => {
    setRates(config.rates[fuel]);
  }, [fuel, config]);

  const vehicleUsd = useMemo(
    () => (currency === "USD" ? supplierPrice : supplierPrice * fx.cny_usd),
    [supplierPrice, currency, fx.cny_usd],
  );

  const breakdown = useMemo(
    () =>
      computeLandedCost({
        vehiclePriceUsd: vehicleUsd,
        freightUsd: fees.freightUsd,
        clearanceUsd: fees.clearanceUsd,
        inlandLogisticsUsd: fees.inlandLogisticsUsd,
        otherUsd: fees.otherUsd,
        rates,
      }),
    [vehicleUsd, fees, rates],
  );

  const suggested = useMemo(() => suggestedListPrice(breakdown.landedCostUsd, margin), [breakdown.landedCostUsd, margin]);
  const actualMarginPct = useMemo(
    () => (listPrice > 0 ? marginPctFromPrice(breakdown.landedCostUsd, listPrice) : null),
    [breakdown.landedCostUsd, listPrice],
  );

  const saveDefaults = async () => {
    setSaving(true);
    setNote(null);
    try {
      const next: ImportConfig = {
        ...config,
        rates: { ...config.rates, [fuel]: rates },
        fees,
        targetMarginPct: margin,
      };
      const res = await fetch("/api/admin/import-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (res.ok) {
        setConfig(next);
        setNote("Saved as defaults for future calculations.");
      } else {
        setNote("Could not save — check the values.");
      }
    } finally {
      setSaving(false);
    }
  };

  const saveToCar = async () => {
    if (!carId) return;
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch(`/api/admin/cars/${carId}/cost`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cost_usd: Math.round(breakdown.landedCostUsd) }),
      });
      setNote(res.ok ? `Saved landed cost to ${carLabel}.` : "Could not save to car.");
    } finally {
      setSaving(false);
    }
  };

  const lines: { label: string; value: number; hint?: string }[] = [
    { label: "Vehicle price", value: breakdown.vehiclePriceUsd, hint: currency === "CNY" ? `¥${supplierPrice.toLocaleString()} → USD` : undefined },
    { label: "Freight + insurance", value: breakdown.freightUsd },
    { label: "= CIF value", value: breakdown.cifUsd },
    { label: `Customs duty (${rates.customsDutyPct}%)`, value: breakdown.customsDutyUsd },
    { label: `Excise (${rates.excisePct}%)`, value: breakdown.exciseUsd },
    { label: `VAT / QQS (${rates.vatPct}%)`, value: breakdown.vatUsd },
    { label: "Recycling / util. fee", value: breakdown.recyclingFeeUsd },
    { label: "Certification", value: breakdown.certificationUsd },
    { label: "Clearance / broker", value: breakdown.clearanceUsd },
    { label: "Inland logistics", value: breakdown.inlandLogisticsUsd },
    { label: "Other", value: breakdown.otherUsd },
  ];

  const numInput = (val: number, set: (n: number) => void, opts: { step?: number } = {}) => (
    <Input
      type="number"
      value={Number.isFinite(val) ? val : 0}
      step={opts.step}
      onChange={(e) => set(e.target.value === "" ? 0 : Number(e.target.value))}
      className="text-sm"
    />
  );

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <Ship className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Import calculator</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Supplier price → true landed cost in Tashkent → suggested list price. Rates are your editable
        assumptions — confirm them with your customs broker.
      </p>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* ---- Inputs ---- */}
          <div className="space-y-5">
            <div className="bg-card border border-border p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Supplier quote</h2>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                {numInput(supplierPrice, setSupplierPrice, { step: 1000 })}
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as "CNY" | "USD")}
                  className="h-11 rounded-[2px] border border-border bg-[var(--bg-3)] px-3 text-sm text-foreground"
                >
                  <option value="CNY">CNY ¥</option>
                  <option value="USD">USD $</option>
                </select>
              </div>
              <p className="text-[11px] text-muted-foreground">
                = {usd(vehicleUsd)} at CBU rates (USD {fx.usd_uzs.toLocaleString()} · CNY {fx.cny_uzs.toLocaleString()} so&apos;m
                {fx.updated_at ? ` · ${fx.updated_at.slice(0, 10)}` : " · fallback"})
              </p>
              <div>
                <label className="text-xs text-muted-foreground">Fuel type (sets default duty/excise)</label>
                <select
                  value={fuel}
                  onChange={(e) => setFuel(e.target.value as FuelKind)}
                  className="mt-1 w-full h-11 rounded-[2px] border border-border bg-[var(--bg-3)] px-3 text-sm text-foreground"
                >
                  {FUEL_KINDS.map((f) => (
                    <option key={f} value={f}>{FUEL_LABELS[f]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-card border border-border p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Tax rates ({FUEL_LABELS[fuel]})</h2>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-[11px] text-muted-foreground">Duty %</label>{numInput(rates.customsDutyPct, (n) => setRates({ ...rates, customsDutyPct: n }))}</div>
                <div><label className="text-[11px] text-muted-foreground">Excise %</label>{numInput(rates.excisePct, (n) => setRates({ ...rates, excisePct: n }))}</div>
                <div><label className="text-[11px] text-muted-foreground">VAT %</label>{numInput(rates.vatPct, (n) => setRates({ ...rates, vatPct: n }))}</div>
                <div><label className="text-[11px] text-muted-foreground">Recycling $</label>{numInput(rates.recyclingFeeUsd, (n) => setRates({ ...rates, recyclingFeeUsd: n }))}</div>
                <div><label className="text-[11px] text-muted-foreground">Cert. $</label>{numInput(rates.certificationUsd, (n) => setRates({ ...rates, certificationUsd: n }))}</div>
              </div>
            </div>

            <div className="bg-card border border-border p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Logistics &amp; fees (USD)</h2>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[11px] text-muted-foreground">Freight + insurance</label>{numInput(fees.freightUsd, (n) => setFees({ ...fees, freightUsd: n }), { step: 100 })}</div>
                <div><label className="text-[11px] text-muted-foreground">Clearance / broker</label>{numInput(fees.clearanceUsd, (n) => setFees({ ...fees, clearanceUsd: n }), { step: 50 })}</div>
                <div><label className="text-[11px] text-muted-foreground">Inland logistics</label>{numInput(fees.inlandLogisticsUsd, (n) => setFees({ ...fees, inlandLogisticsUsd: n }), { step: 50 })}</div>
                <div><label className="text-[11px] text-muted-foreground">Other</label>{numInput(fees.otherUsd, (n) => setFees({ ...fees, otherUsd: n }), { step: 50 })}</div>
              </div>
            </div>
          </div>

          {/* ---- Results ---- */}
          <div className="space-y-5">
            <div className="bg-card border border-border p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">Cost breakdown (per unit)</h2>
              <table className="w-full text-sm">
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.label} className="border-b border-border/60 last:border-0">
                      <td className="py-1.5 text-muted-foreground">
                        {l.label}{l.hint && <span className="text-[11px] opacity-70"> · {l.hint}</span>}
                      </td>
                      <td className="py-1.5 text-right font-mono text-foreground">{usd(l.value)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border">
                    <td className="py-2 font-semibold text-foreground">Landed cost</td>
                    <td className="py-2 text-right font-mono font-semibold text-foreground">{usd(breakdown.landedCostUsd)}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-[11px] text-muted-foreground">in so&apos;m</td>
                    <td className="py-0.5 text-right font-mono text-[11px] text-muted-foreground">{uzs(breakdown.landedCostUsd * fx.usd_uzs)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-card border border-border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">Suggested list price</h2>
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] text-muted-foreground">margin %</label>
                  <Input type="number" value={margin} onChange={(e) => setMargin(e.target.value === "" ? 0 : Number(e.target.value))} className="w-20 h-9 text-sm" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold text-primary">{usd(suggested)}</span>
                <span className="text-xs text-muted-foreground">{uzs(suggested * fx.usd_uzs)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Gross margin ≈ {usd(suggested - breakdown.landedCostUsd)} / unit at {margin}% over landed cost.
              </p>

              <div className="pt-2 border-t border-border">
                <label className="text-[11px] text-muted-foreground">
                  Check margin at an actual list price (USD)
                  {marketLabel && <span className="text-primary"> · {marketLabel}</span>}
                </label>
                <div className="flex items-center gap-3 mt-1">
                  <Input type="number" value={listPrice || ""} placeholder="e.g. 43000" onChange={(e) => setListPrice(e.target.value === "" ? 0 : Number(e.target.value))} className="w-40 text-sm" />
                  {actualMarginPct != null && (
                    <span className={`text-sm font-mono ${actualMarginPct >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                      {actualMarginPct >= 0 ? "+" : ""}{actualMarginPct}% · {usd(listPrice - breakdown.landedCostUsd)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={saveDefaults} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save as defaults</>}
              </Button>
              {carId && (
                <Button size="sm" onClick={saveToCar} disabled={saving}>
                  Save landed cost to {carLabel}
                </Button>
              )}
              {note && <span className="text-xs text-primary">{note}</span>}
            </div>

            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Info className="w-3.5 h-3.5 mt-px shrink-0" />
              These rates are editable assumptions, not legal advice. Uzbekistan&apos;s duties/excise/fees
              change and depend on importer type, engine volume, age and fuel — confirm the live figures.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
