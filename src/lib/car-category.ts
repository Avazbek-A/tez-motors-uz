import type { Car } from "@/types/car";

/**
 * Professional, normalized categorization derived from a car's price + the rich
 * (translated) AutoHome specs in spec_data. This is what lets the AI assistant
 * answer real client questions — "family 7-seater", "long-range EV for highway",
 * "cheap city car", "business sedan", "AWD for rough roads", "something sporty" —
 * instead of only reasoning about price. Pure + defensive (any field may be null).
 */
export interface CarCategory {
  powertrain: "electric" | "phev" | "hybrid" | "petrol" | "diesel" | "unknown";
  segment: "budget" | "mid-range" | "premium" | "luxury";
  sizeClass: "compact" | "midsize" | "large" | "full-size" | null;
  performance: "economy" | "balanced" | "sporty" | "high-performance";
  seats: number | null;
  rangeKm: number | null; // electric range (EV/PHEV)
  horsepower: number | null;
  zeroTo100: number | null; // seconds
  lengthMm: number | null;
  trunkL: number | null;
  groundClearanceMm: number | null;
  driveType: "awd" | "rwd" | "fwd" | null;
  /** Human use-case tags the assistant matches against client intent. */
  useCases: string[];
}

// Premium/luxury marques (incl. Chinese premium EV sub-brands).
const PREMIUM_BRANDS = new Set([
  "Mercedes-Benz", "BMW", "Audi", "Porsche", "Lamborghini", "Genesis", "Volvo",
  "VOYAH", "Hongqi", "Maextro", "Yangwang", "Avatr", "Zeekr", "NIO", "Li Auto",
  "Onvo", "Stelato", "Denza", "Lixiang",
]);
const ULTRA_LUX_BRANDS = new Set(["Porsche", "Lamborghini", "Yangwang", "Maextro"]);

type Trim = { params?: Record<string, Record<string, string>> };
function trims(car: Car): Trim[] {
  const sd = car.spec_data as unknown as { i18n?: { en?: { trims?: Trim[] } }; trims?: Trim[] } | null;
  return (sd?.i18n?.en?.trims || sd?.trims || []) as Trim[];
}
function num(s: string | undefined | null): number | null {
  if (s == null) return null;
  const m = String(s).match(/-?\d[\d.]*/);
  const n = m ? parseFloat(m[0]) : NaN;
  return Number.isFinite(n) ? n : null;
}
/** First param value across all trims whose key matches `re`. */
function param(car: Car, re: RegExp): string | undefined {
  for (const t of trims(car)) {
    for (const group of Object.values(t.params || {})) {
      const k = Object.keys(group).find((key) => re.test(key));
      if (k) return group[k];
    }
  }
  return undefined;
}
/** Max numeric value across all trims for keys matching `re` (best-case spec). */
function maxNum(car: Car, re: RegExp): number | null {
  let best: number | null = null;
  for (const t of trims(car)) {
    for (const group of Object.values(t.params || {})) {
      for (const [k, v] of Object.entries(group)) {
        if (re.test(k)) { const n = num(v); if (n != null && (best == null || n > best)) best = n; }
      }
    }
  }
  return best;
}

export function categorizeCar(car: Car): CarCategory {
  const price = Number(car.price_usd) || 0;
  const fuel = (car.fuel_type || "").toLowerCase();
  const body = (car.body_type || "").toLowerCase();

  const powertrain: CarCategory["powertrain"] =
    fuel.includes("electric") ? "electric"
    : fuel.includes("phev") || fuel.includes("plug") ? "phev"
    : fuel.includes("hybrid") ? "hybrid"
    : fuel.includes("diesel") ? "diesel"
    : fuel.includes("petrol") || fuel.includes("gasolin") ? "petrol"
    : "unknown";

  const rangeKm = maxNum(car, /electric range.*\(km\)|range.*\(km\).*electric|CLTC.*km|WLTC.*range|NEDC.*range/i);
  // horsepower: prefer Ps; else convert max kW (×1.341)
  const ps = maxNum(car, /horsepower|\(Ps\)|\(hp\)/i);
  const kw = maxNum(car, /maximum (net )?power.*\(kW\)|total motor power.*\(kW\)/i);
  const horsepower = ps ?? (kw != null ? Math.round(kw * 1.341) : (car.engine_power ? Number(car.engine_power) : null));
  const zeroTo100 = (() => { const v = param(car, /0[–-]100 km\/h accel/i); const n = num(v); return n; })();
  const lengthMm = num(param(car, /^Length \(mm\)/i));
  const wheelbaseMm = num(param(car, /Wheelbase \(mm\)/i));
  const trunkL = maxNum(car, /Trunk volume \(L\)/i);
  const groundClearanceMm = maxNum(car, /ground clearance.*\(mm\)/i);
  const seats = num(param(car, /^(Number of )?[Ss]eats|Seating/i)) ?? inferSeats(body);
  const driveType = ((): CarCategory["driveType"] => {
    const dt = (car.drivetrain || "") + " " + (param(car, /Drive (type|form)|Drivetrain|Driven wheels/i) || "");
    if (/awd|4wd|all.?wheel|four.?wheel|quattro|xdrive/i.test(dt)) return "awd";
    if (/rwd|rear.?wheel/i.test(dt)) return "rwd";
    if (/fwd|front.?wheel/i.test(dt)) return "fwd";
    return null;
  })();

  // segment from price + brand
  const premium = PREMIUM_BRANDS.has(car.brand);
  const segment: CarCategory["segment"] =
    price >= 90000 || (ULTRA_LUX_BRANDS.has(car.brand) && price > 0) ? "luxury"
    : price >= 45000 || (premium && price >= 35000) ? "premium"
    : price >= 20000 ? "mid-range"
    : "budget";

  // size class from length (+ wheelbase nudge)
  const L = lengthMm ?? 0;
  const sizeClass: CarCategory["sizeClass"] =
    L === 0 ? null
    : L < 4300 ? "compact"
    : L < 4750 ? "midsize"
    : L < 5050 ? "large"
    : "full-size";

  // performance from 0-100 + power
  const performance: CarCategory["performance"] =
    (zeroTo100 != null && zeroTo100 <= 4.5) || (horsepower != null && horsepower >= 500) ? "high-performance"
    : (zeroTo100 != null && zeroTo100 <= 6.5) || (horsepower != null && horsepower >= 320) ? "sporty"
    : (zeroTo100 != null && zeroTo100 <= 10) || (horsepower != null && horsepower >= 150) ? "balanced"
    : "economy";

  // ---- use-case tags (what the assistant matches client intent against) ----
  const tags = new Set<string>();
  const isSUV = /suv|crossover/.test(body);
  const seatsN = seats ?? (isSUV || body.includes("minivan") ? 5 : 5);
  if (seatsN >= 6 || body.includes("minivan")) tags.add("big-family");
  if (seatsN >= 5 && (isSUV || body.includes("minivan") || (trunkL ?? 0) >= 450)) tags.add("family");
  if (sizeClass === "compact" || (L > 0 && L < 4400)) tags.add("city");
  if (body.includes("sedan") && (segment === "premium" || segment === "luxury")) tags.add("business");
  if (isSUV && ((groundClearanceMm ?? 0) >= 190 || driveType === "awd")) tags.add("off-road");
  if (performance === "sporty" || performance === "high-performance") tags.add("performance");
  if (powertrain === "electric" && (rangeKm ?? 0) >= 450) tags.add("long-range");
  if (powertrain === "petrol" || powertrain === "diesel" || powertrain === "hybrid") tags.add("long-distance");
  if (segment === "budget") tags.add("budget");
  if ((segment === "budget" || segment === "mid-range") && sizeClass !== "full-size") tags.add("first-car");
  if (powertrain === "electric" || powertrain === "hybrid" || powertrain === "phev") tags.add("eco");
  if ((trunkL ?? 0) >= 500) tags.add("cargo");
  if (segment === "luxury" || segment === "premium") tags.add("prestige");

  return {
    powertrain, segment, sizeClass, performance,
    seats: seats ?? null, rangeKm, horsepower, zeroTo100,
    lengthMm, trunkL, groundClearanceMm, driveType,
    useCases: [...tags],
  };
}

function inferSeats(body: string): number | null {
  if (body.includes("minivan")) return 7;
  if (body.includes("coupe")) return 4;
  if (/suv|crossover|sedan|hatchback/.test(body)) return 5;
  return null;
}
