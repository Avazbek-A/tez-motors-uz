/**
 * Shipment milestone flow — pure helpers (unit-tested). The canonical ordered
 * milestones an imported batch passes through, plus progress + next-step math
 * shared by the shipments API and UI.
 */
import type { Locale } from "@/i18n/config";

export const SHIPMENT_MILESTONES = [
  "created",
  "supplier_paid",
  "in_production",
  "shipped",
  "in_transit",
  "at_customs",
  "cleared",
  "arrived",
  "delivered",
] as const;

export type ShipmentMilestone = (typeof SHIPMENT_MILESTONES)[number];

const LABELS: Record<ShipmentMilestone, string> = {
  created: "Created",
  supplier_paid: "Supplier paid",
  in_production: "In production",
  shipped: "Shipped",
  in_transit: "In transit",
  at_customs: "At customs",
  cleared: "Customs cleared",
  arrived: "Arrived",
  delivered: "Delivered",
};

/**
 * Localized milestone names for display. `en` mirrors the canonical LABELS map
 * (the value returned when no locale is passed), keeping server-side callers
 * stable. Same key set across every locale.
 */
const LABELS_I18N: Record<Locale, Record<ShipmentMilestone, string>> = {
  ru: {
    created: "Создана",
    supplier_paid: "Оплачено поставщику",
    in_production: "В производстве",
    shipped: "Отгружено",
    in_transit: "В пути",
    at_customs: "На таможне",
    cleared: "Таможня пройдена",
    arrived: "Прибыло",
    delivered: "Выдано",
  },
  uz: {
    created: "Yaratilgan",
    supplier_paid: "Yetkazib beruvchiga to'langan",
    in_production: "Ishlab chiqarishda",
    shipped: "Jo'natilgan",
    in_transit: "Yo'lda",
    at_customs: "Bojxonada",
    cleared: "Bojxonadan o'tgan",
    arrived: "Yetib keldi",
    delivered: "Topshirilgan",
  },
  en: { ...LABELS },
};

/**
 * Human label for a milestone. When `locale` is omitted, returns the canonical
 * English label (server callers rely on this stable value); pass a locale to
 * localize for display. Unknown milestones fall back to the raw string.
 */
export function milestoneLabel(m: string, locale?: Locale): string {
  if (locale) {
    return LABELS_I18N[locale]?.[m as ShipmentMilestone] ?? LABELS[m as ShipmentMilestone] ?? m;
  }
  return LABELS[m as ShipmentMilestone] ?? m;
}

export function milestoneIndex(m: string): number {
  return SHIPMENT_MILESTONES.indexOf(m as ShipmentMilestone);
}

export function isValidMilestone(m: string): m is ShipmentMilestone {
  return SHIPMENT_MILESTONES.includes(m as ShipmentMilestone);
}

/** The next milestone after the current one, or null if terminal/unknown. */
export function nextMilestone(current: string): ShipmentMilestone | null {
  const i = milestoneIndex(current);
  if (i < 0 || i >= SHIPMENT_MILESTONES.length - 1) return null;
  return SHIPMENT_MILESTONES[i + 1];
}

export function isTerminal(m: string): boolean {
  return m === "delivered";
}

/** 0–100 progress through the pipeline. */
export function progressPct(current: string): number {
  const i = milestoneIndex(current);
  if (i < 0) return 0;
  return Math.round((i / (SHIPMENT_MILESTONES.length - 1)) * 100);
}

/** Milestones at/before `current` are done; the rest are pending. */
export function milestoneStatus(milestone: string, current: string): "done" | "current" | "pending" {
  const mi = milestoneIndex(milestone);
  const ci = milestoneIndex(current);
  if (mi < 0 || ci < 0) return "pending";
  if (mi < ci) return "done";
  if (mi === ci) return "current";
  return "pending";
}
