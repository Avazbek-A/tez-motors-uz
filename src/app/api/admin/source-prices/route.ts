import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getFxRates, cnyToUsd } from "@/lib/fx-rate";
import { parseRfq } from "@/lib/rfq-parse";
import { logAdminAction } from "@/lib/audit";

/**
 * Source prices from supplier quotes (Phase AK polish). Admin-gated.
 *  GET  — recent source prices (optionally ?brand=&model=).
 *  POST — paste a quote { brand, model, text, supplier? }; parse + normalize to
 *         USD (CNY via the live rate) and store as forward cost for the Buying
 *         Brain.
 */
const createSchema = z.object({
  brand: z.string().min(1).max(64),
  model: z.string().min(1).max(128),
  text: z.string().min(2).max(8000),
  supplier: z.string().max(120).optional().nullable(),
});

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const { searchParams } = new URL(request.url);
  const supabase = createServiceClient();
  let q = supabase
    .from("source_prices")
    .select("id, brand, model, price_usd, price_cny, lead_time_days, moq, supplier, observed_at")
    .order("observed_at", { ascending: false })
    .limit(500);
  const brand = searchParams.get("brand");
  const model = searchParams.get("model");
  if (brand) q = q.ilike("brand", brand);
  if (model) q = q.ilike("model", `%${model}%`);
  const { data } = await q;
  return NextResponse.json({ source_prices: data || [] });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const fields = await parseRfq(parsed.data.text);
  const supabase = createServiceClient();

  // Normalize to USD: prefer an explicit USD quote; else convert the CNY quote.
  let priceUsd = fields.priceUsd;
  if (priceUsd == null && fields.priceCny != null) {
    const fx = await getFxRates(supabase);
    priceUsd = Math.round(cnyToUsd(fields.priceCny, fx.cny_uzs, fx.usd_uzs));
  }

  const { data, error } = await supabase
    .from("source_prices")
    .insert({
      brand: parsed.data.brand,
      model: parsed.data.model,
      price_usd: priceUsd,
      price_cny: fields.priceCny,
      lead_time_days: fields.leadTimeDays,
      moq: fields.moq,
      supplier: parsed.data.supplier ?? null,
      raw: parsed.data.text.slice(0, 8000),
    })
    .select("id, brand, model, price_usd, price_cny, lead_time_days, moq")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAdminAction(request, {
    action: "create",
    entity: "source_price",
    entity_id: data.id,
    diff: { brand: parsed.data.brand, model: parsed.data.model, price_usd: priceUsd, ai: fields.ai },
  }).catch(() => {});

  return NextResponse.json({ success: true, parsed: data }, { status: 201 });
}
