import { z } from "zod";
import { safeHttpUrl } from "./safe-url";

export const SCOOTER_KINDS = ["escooter", "ebike"] as const;
export type ScooterKind = (typeof SCOOTER_KINDS)[number];

export const scooterWriteSchema = z.object({
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/i, "slug must be kebab-case"),
  kind: z.enum(SCOOTER_KINDS).default("escooter"),
  brand: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  description_ru: z.string().max(4000).optional().nullable(),
  description_uz: z.string().max(4000).optional().nullable(),
  description_en: z.string().max(4000).optional().nullable(),
  price_usd: z.number().nonnegative().optional().nullable(),
  original_price_usd: z.number().nonnegative().optional().nullable(),
  price_uzs: z.number().nonnegative().optional().nullable(),
  motor_power_w: z.number().int().min(0).max(20000).optional().nullable(),
  battery_wh: z.number().int().min(0).max(10000).optional().nullable(),
  range_km: z.number().int().min(0).max(1000).optional().nullable(),
  top_speed_kmh: z.number().int().min(0).max(200).optional().nullable(),
  max_load_kg: z.number().int().min(0).max(500).optional().nullable(),
  weight_kg: z.number().min(0).max(500).optional().nullable(),
  wheel_size_inch: z.number().min(0).max(40).optional().nullable(),
  foldable: z.boolean().optional().nullable(),
  color: z.string().max(100).optional().nullable(),
  // safeHttpUrl: rejects javascript:/data:/file: so a stored URL can't become a
  // DOM XSS when rendered as <img src> on the storefront.
  images: z.array(safeHttpUrl).max(40).default([]),
  stock_qty: z.number().int().min(0).default(0),
  is_published: z.boolean().default(false),
  order_position: z.number().int().min(0).default(0),
});

export type ScooterWriteInput = z.infer<typeof scooterWriteSchema>;
