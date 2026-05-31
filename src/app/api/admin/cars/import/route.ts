import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { parseCsvToObjects } from "@/lib/csv";
import { carWriteSchema } from "@/lib/schemas/car";

export const runtime = "nodejs";

const LIST_DELIMITERS = /[;|]/;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
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

function parseBoolOrUndef(raw: string): boolean | undefined {
  const v = (raw || "").trim();
  if (!v) return undefined; // let the schema default apply
  return /^(true|yes|1|y|да|ha)$/i.test(v);
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
  dry_run?: boolean;
  errors: Array<{ row: number; slug?: string; message: string }>;
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const dryRun = new URL(request.url).searchParams.get("dry") === "true";
  let csvText: string;
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing 'file' field in form-data" }, { status: 400 });
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
    const rowNum = i + 2; // +1 header, +1 one-index
    const r = rows[i];

    const brand = r.brand?.trim();
    const model = r.model?.trim();
    if (!brand || !model) {
      result.errors.push({ row: rowNum, message: "brand and model are required" });
      result.skipped += 1;
      continue;
    }

    const slug =
      r.slug?.trim() || slugify(`${brand}-${model}-${r.year ?? ""}`);

    // Empty enum/boolean cells become undefined so schema defaults apply.
    const payload = {
      brand,
      model,
      year: parseInt10(r.year),
      price_usd: parseInt10(r.price_usd),
      original_price_usd: parseInt10(r.original_price_usd),
      price_uzs: parseInt10(r.price_uzs),
      body_type: r.body_type?.trim().toLowerCase() || undefined,
      fuel_type: r.fuel_type?.trim().toLowerCase() || undefined,
      engine_volume: parseNumber(r.engine_volume),
      engine_power: parseInt10(r.engine_power),
      transmission: r.transmission?.trim().toLowerCase() || undefined,
      drivetrain: r.drivetrain?.trim().toLowerCase() || undefined,
      mileage: parseInt10(r.mileage) ?? undefined,
      color: r.color || null,
      description_ru: r.description_ru || null,
      description_uz: r.description_uz || null,
      description_en: r.description_en || null,
      images: parseList(r.images || r.image_urls || ""),
      thumbnail: r.thumbnail || null,
      video_url: r.video_url || null,
      is_hot_offer: parseBoolOrUndef(r.is_hot_offer || r.hot_offer || ""),
      // is_available is derived (GENERATED) from inventory_status — never imported directly.
      inventory_status: r.inventory_status?.trim().toLowerCase() || undefined,
      order_position: parseInt10(r.order_position) ?? undefined,
    };

    const parsed = carWriteSchema.safeParse(payload);
    if (!parsed.success) {
      const msg = parsed.error.issues
        .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
        .join("; ");
      result.errors.push({ row: rowNum, slug, message: msg });
      result.skipped += 1;
      continue;
    }

    // carWriteSchema has no slug field; attach it for upsert.
    const record = { ...parsed.data, slug };

    const { data: existing } = await supabase
      .from("cars")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (dryRun) {
      if (existing?.id) result.updated += 1;
      else result.inserted += 1;
      continue;
    }

    if (existing?.id) {
      const { error } = await supabase.from("cars").update(record).eq("id", existing.id);
      if (error) {
        result.errors.push({ row: rowNum, slug, message: error.message });
        result.skipped += 1;
      } else {
        result.updated += 1;
      }
    } else {
      const { error } = await supabase.from("cars").insert(record);
      if (error) {
        result.errors.push({ row: rowNum, slug, message: error.message });
        result.skipped += 1;
      } else {
        result.inserted += 1;
      }
    }
  }

  if (dryRun) result.dry_run = true;
  return NextResponse.json(result);
}
