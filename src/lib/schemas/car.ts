import { z } from "zod";

export const carWriteSchema = z.object({
  brand: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(2000).max(2030),
  price_usd: z.number().int().positive(),
  original_price_usd: z.number().int().positive().optional().nullable(),
  price_uzs: z.number().int().positive().optional().nullable(),
  body_type: z.enum(["sedan", "suv", "hatchback", "coupe", "wagon", "van", "truck", "crossover", "minivan", "pickup"]).default("suv"),
  fuel_type: z.enum(["petrol", "diesel", "hybrid", "electric", "phev", "gas"]).default("petrol"),
  engine_volume: z.number().min(0).max(10).optional().nullable(),
  engine_power: z.number().int().min(0).max(2000).optional().nullable(),
  transmission: z.enum(["automatic", "manual", "cvt", "dct", "robot"]).default("automatic"),
  drivetrain: z.enum(["fwd", "rwd", "awd", "4wd"]).optional().nullable(),
  mileage: z.number().int().min(0).default(0),
  color: z.string().max(100).optional().nullable(),
  description_ru: z.string().max(5000).optional().nullable(),
  description_uz: z.string().max(5000).optional().nullable(),
  description_en: z.string().max(5000).optional().nullable(),
  images: z.array(z.string().url()).default([]),
  thumbnail: z.string().url().optional().nullable(),
  video_url: z.string().url().optional().nullable(),
  is_hot_offer: z.boolean().default(false),
  is_available: z.boolean().default(true),
  inventory_status: z.enum(["available", "reserved", "sold"]).default("available"),
  order_position: z.number().int().min(0).default(0),
  specs: z.record(z.string(), z.unknown()).default({}),
});

export const reviewWriteSchema = z.object({
  client_name: z.string().min(1).max(200),
  rating: z.number().int().min(1).max(5).default(5),
  review_text_ru: z.string().max(3000).optional().nullable(),
  review_text_uz: z.string().max(3000).optional().nullable(),
  review_text_en: z.string().max(3000).optional().nullable(),
  car_description: z.string().max(300).optional().nullable(),
  photo_url: z.string().url().optional().nullable(),
  video_url: z.string().url().optional().nullable(),
  is_published: z.boolean().default(false),
  order_position: z.number().int().min(0).default(0),
  car_id: z.string().uuid().optional().nullable(),
});

export const faqWriteSchema = z.object({
  question_ru: z.string().min(1).max(500),
  answer_ru: z.string().min(1).max(5000),
  question_uz: z.string().max(500).optional().nullable(),
  answer_uz: z.string().max(5000).optional().nullable(),
  question_en: z.string().max(500).optional().nullable(),
  answer_en: z.string().max(5000).optional().nullable(),
  category: z.string().max(100).default("general"),
  order_position: z.number().int().min(0).default(0),
  is_published: z.boolean().default(true),
});

export const inquiryUpdateSchema = z.object({
  status: z.enum(["new", "contacted", "in_progress", "closed"]),
  notes: z.string().max(5000).optional().nullable(),
  follow_up_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
});
