import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { parseCsvToObjects } from "@/lib/csv";
import { partWriteSchema, PART_CATEGORIES } from "@/lib/schemas/part";

export const runtime = "nodejs";

const LIST_DELIMITERS = /[;|]/;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function parseList(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(LIST_DELIMITERS)
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseBool(raw: string): boolean {
  return /^(true|yes|1|y|да|ha)$/i.test(raw.trim());
}

function parseNumber(raw: string): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/,/g, "."));
  return Number.isFinite(n) ? n : null;
}

function parseInt10(raw: string): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; slug?: string; message: string }>;
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  let csvText: string;
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Missing 'file' field in form-data" },
          { status: 400 },
        );
      }
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "CSV too large (max 5 MB)" }, { status: 413 });
      }
      csvText = await file.text();
    } else {
      csvText = await request.text();
    }
  } catch {
    return NextResponse.json({ error: "Failed to read CSV body" }, { status: 400 });
  }

  const rows = parseCsvToObjects(csvText);
  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i += 1) {
    const rowNum = i + 2; // +1 for header, +1 for 1-index
    const r = rows[i];

    const nameRu = r.name_ru || r.name;
    if (!nameRu) {
      result.errors.push({ row: rowNum, message: "name_ru is required" });
      result.skipped += 1;
      continue;
    }

    const slug = r.slug?.trim() || slugify(`${nameRu}-${r.oem_number ?? ""}`);
    const category = (r.category || "other").toLowerCase();
    if (!(PART_CATEGORIES as readonly string[]).includes(category)) {
      result.errors.push({
        row: rowNum,
        slug,
        message: `invalid category "${r.category}" (must be one of: ${PART_CATEGORIES.join(", ")})`,
      });
      result.skipped += 1;
      continue;
    }

    const payload = {
      slug,
      oem_number: r.oem_number || null,
      name_ru: nameRu,
      name_uz: r.name_uz || null,
      name_en: r.name_en || null,
      description_ru: r.description_ru || null,
      description_uz: r.description_uz || null,
      description_en: r.description_en || null,
      category,
      brand: r.brand || null,
      price_usd: parseNumber(r.price_usd),
      original_price_usd: parseNumber(r.original_price_usd),
      stock_qty: parseInt10(r.stock_qty) ?? 0,
      images: parseList(r.images || r.image_urls || ""),
      is_published: parseBool(r.is_published || r.published || "false"),
      fits_brands: parseList(r.fits_brands),
      fits_models: parseList(r.fits_models),
      fits_year_from: parseInt10(r.fits_year_from),
      fits_year_to: parseInt10(r.fits_year_to),
      order_position: parseInt10(r.order_position) ?? 0,
    };

    const parsed = partWriteSchema.safeParse(payload);
    if (!parsed.success) {
      const msg = parsed.error.issues
        .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
        .join("; ");
      result.errors.push({ row: rowNum, slug, message: msg });
      result.skipped += 1;
      continue;
    }

    // Upsert on slug
    const { data: existing } = await supabase
      .from("parts")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from("parts")
        .update(parsed.data)
        .eq("id", existing.id);
      if (error) {
        result.errors.push({ row: rowNum, slug, message: error.message });
        result.skipped += 1;
      } else {
        result.updated += 1;
      }
    } else {
      const { error } = await supabase.from("parts").insert(parsed.data);
      if (error) {
        result.errors.push({ row: rowNum, slug, message: error.message });
        result.skipped += 1;
      } else {
        result.inserted += 1;
      }
    }
  }

  return NextResponse.json(result);
}
