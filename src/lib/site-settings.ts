import { z } from "zod";
import { SITE_CONFIG } from "@/lib/constants";

export const SiteSettingsSchema = z.object({
  siteName: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  phoneRaw: z.string().max(50).optional(),
  email: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  workingHours: z.string().max(200).optional(),
  telegram: z.string().url().max(500).optional().or(z.literal("")),
  instagram: z.string().url().max(500).optional().or(z.literal("")),
  whatsapp: z.string().url().max(500).optional().or(z.literal("")),
  // Showroom pin in WGS84 decimal degrees. The dealer can refine via
  // /admin/settings once they confirm the exact spot on the lot.
  mapLat: z.number().min(-90).max(90).optional(),
  mapLng: z.number().min(-180).max(180).optional(),
});

export type SiteSettings = z.infer<typeof SiteSettingsSchema>;

export type ResolvedSiteSettings = {
  siteName: string;
  phone: string;
  phoneRaw: string;
  email: string;
  address: string;
  workingHours: string;
  telegram: string;
  instagram: string;
  whatsapp: string;
  mapLat: number;
  mapLng: number;
};

// Default pin: Tez Motors showroom, Chilanzar district, Tashkent.
// Confirmed by the dealer on 2026-05-08. Override via /admin/settings.
const DEFAULT_LAT = 41.29532;
const DEFAULT_LNG = 69.216001;

export function mergeWithDefaults(
  overrides: Partial<SiteSettings> | null | undefined,
): ResolvedSiteSettings {
  const o = overrides ?? {};
  return {
    siteName: o.siteName || SITE_CONFIG.name,
    phone: o.phone || SITE_CONFIG.phone,
    phoneRaw: o.phoneRaw || SITE_CONFIG.phoneRaw,
    email: o.email || SITE_CONFIG.email,
    address: o.address || SITE_CONFIG.address,
    workingHours: o.workingHours || SITE_CONFIG.workingHours,
    telegram: o.telegram || SITE_CONFIG.telegram,
    instagram: o.instagram || SITE_CONFIG.instagram,
    whatsapp: o.whatsapp || SITE_CONFIG.whatsapp,
    mapLat: typeof o.mapLat === "number" ? o.mapLat : DEFAULT_LAT,
    mapLng: typeof o.mapLng === "number" ? o.mapLng : DEFAULT_LNG,
  };
}
