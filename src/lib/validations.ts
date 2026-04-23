import { z } from "zod";

export const inquirySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  phone: z.string().min(5, "Please enter a valid phone number").max(20),
  email: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  message: z.string().max(2000).optional(),
  type: z.enum(["general", "car_inquiry", "callback", "calculator"]).default("general"),
  car_id: z.string().optional(),
  source_page: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type InquiryFormData = z.infer<typeof inquirySchema>;

export const carSchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(2010).max(2030),
  price_usd: z.number().int().min(1000),
  price_uzs: z.number().int().nullable().optional(),
  body_type: z.enum(["sedan", "suv", "crossover", "hatchback", "minivan", "coupe"]),
  fuel_type: z.enum(["petrol", "electric", "hybrid", "phev"]),
  engine_volume: z.number().nullable().optional(),
  engine_power: z.number().int().nullable().optional(),
  transmission: z.enum(["automatic", "manual", "cvt", "robot", "dct"]),
  drivetrain: z.enum(["fwd", "rwd", "awd"]).nullable().optional(),
  mileage: z.number().int().default(0),
  color: z.string().nullable().optional(),
  description_ru: z.string().nullable().optional(),
  description_uz: z.string().nullable().optional(),
  description_en: z.string().nullable().optional(),
  images: z.array(z.string()).default([]),
  is_hot_offer: z.boolean().default(false),
  is_available: z.boolean().default(true),
});

export type CarFormData = z.infer<typeof carSchema>;
