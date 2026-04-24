import { z } from "zod";

export const PART_CATEGORIES = [
  "engine",
  "body",
  "electrical",
  "suspension",
  "brakes",
  "interior",
  "other",
] as const;

export type PartCategory = (typeof PART_CATEGORIES)[number];

export const partWriteSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/i, "slug must be kebab-case"),
  oem_number: z.string().max(64).optional().nullable(),
  name_ru: z.string().min(1).max(200),
  name_uz: z.string().max(200).optional().nullable(),
  name_en: z.string().max(200).optional().nullable(),
  description_ru: z.string().max(4000).optional().nullable(),
  description_uz: z.string().max(4000).optional().nullable(),
  description_en: z.string().max(4000).optional().nullable(),
  category: z.enum(PART_CATEGORIES),
  brand: z.string().max(100).optional().nullable(),
  price_usd: z.number().nonnegative().optional().nullable(),
  original_price_usd: z.number().nonnegative().optional().nullable(),
  wholesale_price_usd: z.number().nonnegative().optional().nullable(),
  min_order_qty: z.number().int().min(1).default(1),
  stock_qty: z.number().int().min(0).default(0),
  images: z.array(z.string().url()).default([]),
  is_published: z.boolean().default(false),
  fits_brands: z.array(z.string().max(64)).default([]),
  fits_models: z.array(z.string().max(128)).default([]),
  fits_year_from: z.number().int().min(1990).max(2050).optional().nullable(),
  fits_year_to: z.number().int().min(1990).max(2050).optional().nullable(),
  order_position: z.number().int().min(0).default(0),
});

export type PartWriteInput = z.infer<typeof partWriteSchema>;
