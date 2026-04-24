import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { buildCsv } from "@/lib/csv";

export const runtime = "nodejs";

/**
 * Round-trip export of the parts catalog in the same column layout as the
 * import template, so the dealer can edit prices / stock in Excel and
 * re-upload without reformatting.
 */
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

function serializeList(value: unknown): string {
  if (Array.isArray(value)) return value.join(";");
  return "";
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("parts")
    .select("*")
    .order("category")
    .order("name_ru");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((p) => ({
    slug: p.slug ?? "",
    oem_number: p.oem_number ?? "",
    name_ru: p.name_ru ?? "",
    name_uz: p.name_uz ?? "",
    name_en: p.name_en ?? "",
    description_ru: p.description_ru ?? "",
    description_uz: p.description_uz ?? "",
    description_en: p.description_en ?? "",
    category: p.category ?? "",
    brand: p.brand ?? "",
    price_usd: p.price_usd ?? "",
    original_price_usd: p.original_price_usd ?? "",
    wholesale_price_usd: p.wholesale_price_usd ?? "",
    min_order_qty: p.min_order_qty ?? "",
    stock_qty: p.stock_qty ?? 0,
    images: serializeList(p.images),
    is_published: p.is_published ? "true" : "false",
    fits_brands: serializeList(p.fits_brands),
    fits_models: serializeList(p.fits_models),
    fits_year_from: p.fits_year_from ?? "",
    fits_year_to: p.fits_year_to ?? "",
    order_position: p.order_position ?? 0,
  }));

  const body = "\uFEFF" + buildCsv(HEADERS, rows);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="parts-export-${date}.csv"`,
    },
  });
}
