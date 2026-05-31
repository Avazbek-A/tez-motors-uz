import { z } from "zod";

/**
 * model_catalog write validation (Phase W pre-orders). This is the dealer's MENU
 * of importable configurations — distinct from the physical `cars` table. Mirrors
 * the shape of partWriteSchema: kebab-case slug, optional localized copy, image
 * arrays, an orderable flag that gates public visibility.
 */
export const modelObjectSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/i, "slug must be kebab-case"),
  brand: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  trims: z.array(z.string().max(100)).default([]),
  body_type: z.string().max(40).optional().nullable(),
  fuel_type: z.string().max(40).optional().nullable(),
  year: z.number().int().min(2000).max(2035).optional().nullable(),
  base_price_usd: z.number().nonnegative().optional().nullable(),
  lead_time_weeks_min: z.number().int().min(1).max(104).default(6),
  lead_time_weeks_max: z.number().int().min(1).max(104).default(8),
  available_colors: z.array(z.string().max(60)).default([]),
  thumbnail: z.string().url().optional().nullable(),
  images: z.array(z.string().url()).default([]),
  description_ru: z.string().max(5000).optional().nullable(),
  description_uz: z.string().max(5000).optional().nullable(),
  description_en: z.string().max(5000).optional().nullable(),
  is_orderable: z.boolean().default(false),
  order_position: z.number().int().min(0).default(0),
});

const leadTimeOrdered = (v: { lead_time_weeks_min?: number; lead_time_weeks_max?: number }) =>
  v.lead_time_weeks_min == null ||
  v.lead_time_weeks_max == null ||
  v.lead_time_weeks_max >= v.lead_time_weeks_min;

const leadTimeMessage = {
  message: "lead_time_weeks_max must be >= lead_time_weeks_min",
  path: ["lead_time_weeks_max"] as string[],
};

/** Full schema for creating a model (POST). */
export const modelWriteSchema = modelObjectSchema.refine(leadTimeOrdered, leadTimeMessage);

/** Partial schema for editing a model (PUT) — any subset of fields. */
export const modelUpdateSchema = modelObjectSchema.partial().refine(leadTimeOrdered, leadTimeMessage);

export type ModelWriteInput = z.infer<typeof modelWriteSchema>;
