import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { buildCsv } from "@/lib/csv";

export const runtime = "nodejs";

const HEADERS = [
  "slug",
  "oem_number",
  "name_ru",
  "name_uz",
  "name_en",
  "description_ru",
  "description_uz",
  "description_en",
  "category",
  "brand",
  "price_usd",
  "original_price_usd",
  "wholesale_price_usd",
  "min_order_qty",
  "stock_qty",
  "images",
  "is_published",
  "fits_brands",
  "fits_models",
  "fits_year_from",
  "fits_year_to",
  "order_position",
];

// Example rows show format conventions (lists use ; as delimiter).
// The dealer replaces these with their real stock.
const EXAMPLES = [
  {
    slug: "",
    oem_number: "10422800",
    name_ru: "Фильтр воздушный",
    name_uz: "Havo filtri",
    name_en: "Air filter",
    description_ru: "",
    description_uz: "",
    description_en: "",
    category: "engine",
    brand: "Bosch",
    price_usd: "18",
    original_price_usd: "",
    wholesale_price_usd: "14",
    min_order_qty: "5",
    stock_qty: "25",
    images: "",
    is_published: "true",
    fits_brands: "BYD;Chery",
    fits_models: "Song Plus;Tiggo 8",
    fits_year_from: "2021",
    fits_year_to: "2025",
    order_position: "0",
  },
];

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const csv = buildCsv(HEADERS, EXAMPLES);
  // Prefix with UTF-8 BOM so Excel opens Cyrillic correctly
  const body = "\uFEFF" + csv;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="parts-template.csv"',
    },
  });
}
