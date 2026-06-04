import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";

/**
 * Real-user Core Web Vitals collector (Phase AT). The client beacons LCP/CLS/
 * INP/FCP/TTFB here; we store anonymous, non-PII field metrics so the dealer can
 * see the experience real visitors get (complements AQ's synthetic checks).
 * Rate-limited (it's an unauthenticated firehose); fail-open.
 */
const checkRateLimit = createKvRateLimiter({ max: 60, windowMs: 60 * 1000, prefix: "rum" });

const schema = z.object({
  metric: z.enum(["LCP", "CLS", "INP", "FCP", "TTFB"]),
  value: z.number().finite().min(0).max(3_600_000),
  rating: z.enum(["good", "needs-improvement", "poor"]).optional().nullable(),
  path: z.string().max(200).optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    if (!(await checkRateLimit(getClientIp(request)))) {
      return NextResponse.json({ ok: true }); // silently drop excess beacons
    }
    const data = schema.parse(await request.json());
    // Strip any query/hash from the path — keep it a coarse route bucket, no PII.
    const path = data.path ? data.path.split(/[?#]/)[0].slice(0, 200) : null;

    const supabase = createServiceClient();
    await supabase
      .from("web_vitals")
      .insert({ metric: data.metric, value: Math.round(data.value * 1000) / 1000, rating: data.rating ?? null, path })
      .then(() => {}, () => {});
    return NextResponse.json({ ok: true });
  } catch {
    // Never error on a telemetry beacon.
    return NextResponse.json({ ok: true });
  }
}
