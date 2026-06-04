import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import { estimateOsago, estimateKasko, type Region } from "@/lib/insurance";

/**
 * Indicative insurance quote (Phase AP). Returns an OSAGO + KASKO estimate for
 * the given car/region — no PII stored, just a calculation to seed the attach
 * flow. Rate-limited. The binding policy is sold by the insurer/partner.
 */
const checkRateLimit = createKvRateLimiter({ max: 30, windowMs: 10 * 60 * 1000, prefix: "ins-quote" });

const schema = z.object({
  region: z.enum(["tashkent_city", "tashkent_region", "other"]).optional(),
  engine_power_hp: z.number().int().min(0).max(2000).optional().nullable(),
  car_value_usd: z.number().min(0).max(10_000_000).optional().nullable(),
  is_new: z.boolean().optional(),
  unlimited_drivers: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!(await checkRateLimit(getClientIp(request)))) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }
    const data = schema.parse(await request.json());
    const region = (data.region ?? "tashkent_city") as Region;
    const osago = estimateOsago({
      region,
      enginePowerHp: data.engine_power_hp ?? null,
      unlimitedDrivers: data.unlimited_drivers,
    });
    const kasko = data.car_value_usd ? estimateKasko({ carValueUsd: data.car_value_usd, isNew: data.is_new }) : null;
    return NextResponse.json({ ok: true, osago_usd: osago, kasko_usd: kasko, indicative: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
