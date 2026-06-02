import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getFxRates } from "@/lib/fx-rate";
import { logAdminAction } from "@/lib/audit";
import { DEFAULT_IMPORT_CONFIG, FUEL_KINDS, type ImportConfig } from "@/lib/import-cost";

const CONFIG_ROW_ID = "import_config";

const ratesSchema = z.object({
  customsDutyPct: z.number().min(0).max(500),
  excisePct: z.number().min(0).max(500),
  vatPct: z.number().min(0).max(100),
  recyclingFeeUsd: z.number().min(0).max(1_000_000),
  certificationUsd: z.number().min(0).max(1_000_000),
});

const feesSchema = z.object({
  freightUsd: z.number().min(0).max(1_000_000),
  clearanceUsd: z.number().min(0).max(1_000_000),
  inlandLogisticsUsd: z.number().min(0).max(1_000_000),
  otherUsd: z.number().min(0).max(1_000_000),
});

const configSchema = z.object({
  rates: z.object({
    petrol: ratesSchema,
    diesel: ratesSchema,
    hybrid: ratesSchema,
    phev: ratesSchema,
    electric: ratesSchema,
  }),
  fees: feesSchema,
  targetMarginPct: z.number().min(0).max(500),
});

/** Merge a stored (possibly partial) config over the defaults so the UI always
 *  has a complete, valid shape even before the row has ever been saved. */
function mergeConfig(stored: unknown): ImportConfig {
  const s = (stored && typeof stored === "object" ? stored : {}) as Partial<ImportConfig>;
  const rates = { ...DEFAULT_IMPORT_CONFIG.rates };
  for (const f of FUEL_KINDS) {
    rates[f] = { ...DEFAULT_IMPORT_CONFIG.rates[f], ...(s.rates?.[f] ?? {}) };
  }
  return {
    rates,
    fees: { ...DEFAULT_IMPORT_CONFIG.fees, ...(s.fees ?? {}) },
    targetMarginPct:
      typeof s.targetMarginPct === "number" ? s.targetMarginPct : DEFAULT_IMPORT_CONFIG.targetMarginPct,
  };
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const supabase = createServiceClient();
  const [{ data }, fx] = await Promise.all([
    supabase.from("site_settings").select("values").eq("id", CONFIG_ROW_ID).maybeSingle(),
    getFxRates(supabase),
  ]);

  return NextResponse.json({ config: mergeConfig(data?.values), fx });
}

export async function PUT(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = configSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("site_settings").upsert({
    id: CONFIG_ROW_ID,
    values: parsed.data,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAdminAction(request, {
    action: "update",
    entity: "import_config",
    diff: { targetMarginPct: parsed.data.targetMarginPct },
  }).catch(() => {});

  return NextResponse.json({ success: true, config: parsed.data });
}
