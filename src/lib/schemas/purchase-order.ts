import { z } from "zod";

export const PURCHASE_ORDER_STATUSES = [
  "draft",
  "ordered",
  "in_production",
  "shipped",
  "arrived",
  "cancelled",
] as const;

export const purchaseOrderWriteSchema = z.object({
  supplier: z.string().max(200).optional().nullable(),
  brand: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  trim: z.string().max(100).optional().nullable(),
  year: z.number().int().min(2000).max(2035).optional().nullable(),
  qty: z.number().int().min(1).max(1000).default(1),
  unit_cost_usd: z.number().min(0).optional().nullable(),
  status: z.enum(PURCHASE_ORDER_STATUSES).default("draft"),
  eta_date: z.string().max(20).optional().nullable(), // YYYY-MM-DD
  notes: z.string().max(2000).optional().nullable(),
});

// Every field optional for PATCH (partial update / status advance).
export const purchaseOrderUpdateSchema = purchaseOrderWriteSchema.partial();
