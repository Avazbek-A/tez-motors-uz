import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getUsdUzsRate } from "@/lib/fx-rate";
import { computeCustomsUz, type VehicleKind, type VehicleAge, type OriginClass, type VehicleCategory } from "@/lib/customs-uz";

/**
 * Leap 4 — customs calibration against real cleared imports.
 *   POST: log one cleared import (specs + actual customs). We compute what the
 *         model PREDICTED for the same inputs and store both → divergence.
 *   GET:  recent log + aggregate accuracy (mean error %, suggested correction).
 * Admin-gated.
 */
const schema = z.object({
  car_id: z.string().regex(/^[a-f0-9-]{1,64}$/i).optional(),
  label: z.string().max(120).optional(),
  category: z.enum(["car", "moto", "engine", "truck", "bus", "fura"]).default("car"),
  kind: z.enum(["electric", "petrol", "diesel", "hybrid", "phev"]).default("petrol"),
  age: z.enum(["new", "used1to3", "used3plus"]).default("new"),
  origin: z.enum(["fta", "certified", "uncertified"]).default("certified"),
  engine_cc: z.number().int().min(0).max(20000).optional(),
  price_usd: z.number().positive().max(10_000_000),
  actual_customs_usd: z.number().positive().max(10_000_000),
  cleared_at: z.string().max(20).optional(),
  note: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  try {
    const data = schema.parse(await request.json());
    const supabase = createServiceClient();
    const usdUzs = await getUsdUzsRate(supabase).catch(() => 12600);
    const predicted = computeCustomsUz({
      priceUsd: data.price_usd, category: data.category as VehicleCategory,
      kind: data.kind as VehicleKind, age: data.age as VehicleAge, origin: data.origin as OriginClass,
      engineCc: data.engine_cc || 0, usdUzs,
    }).customsCostUsd;
    const { data: row, error } = await supabase.from("customs_actuals").insert({
      car_id: data.car_id || null, label: data.label || null, category: data.category, kind: data.kind,
      age: data.age, origin: data.origin, engine_cc: data.engine_cc ?? null, price_usd: data.price_usd,
      predicted_customs_usd: predicted, actual_customs_usd: data.actual_customs_usd,
      cleared_at: data.cleared_at || null, note: data.note || null,
    }).select().single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const deltaPct = predicted > 0 ? Math.round(((data.actual_customs_usd - predicted) / predicted) * 1000) / 10 : null;
    return NextResponse.json({ ok: true, row, predicted, actual: data.actual_customs_usd, deltaPct }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ ok: false, errors: e.issues }, { status: 400 });
    return NextResponse.json({ ok: false, error: "Failed to log" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("customs_actuals")
      .select("id, label, category, kind, age, origin, engine_cc, price_usd, predicted_customs_usd, actual_customs_usd, cleared_at, note, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) return NextResponse.json({ ok: true, hasLog: false, rows: [], stats: null });
    const rows = (data || []).map((r) => {
      const p = Number(r.predicted_customs_usd) || 0, a = Number(r.actual_customs_usd) || 0;
      return { ...r, deltaPct: p > 0 ? Math.round(((a - p) / p) * 1000) / 10 : null, ratio: p > 0 ? a / p : null };
    });
    const ratios = rows.map((r) => r.ratio).filter((x): x is number => typeof x === "number" && isFinite(x));
    let stats = null;
    if (ratios.length) {
      const meanRatio = ratios.reduce((s, x) => s + x, 0) / ratios.length;
      const meanErrPct = Math.round((meanRatio - 1) * 1000) / 10;
      const within10 = rows.filter((r) => r.deltaPct != null && Math.abs(r.deltaPct) <= 10).length;
      stats = {
        count: ratios.length,
        meanErrPct,                       // + = model under-predicts vs reality
        correctionFactor: Math.round(meanRatio * 1000) / 1000, // multiply predictions by this
        within10Pct: within10,
        accuracyPct: Math.round((within10 / ratios.length) * 100),
      };
    }
    return NextResponse.json({ ok: true, hasLog: true, rows, stats });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to read" }, { status: 500 });
  }
}
