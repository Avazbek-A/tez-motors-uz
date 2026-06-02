/**
 * Bearer guard for scheduled jobs under /api/cron/*.
 *
 * OpenNext's generated Worker exports only `fetch` (no `scheduled()` handler),
 * so Cron Triggers can't call into the Next app directly. Instead a tiny
 * separate cron Worker (see cron-worker/) fires these routes on a schedule with
 * `Authorization: Bearer <CRON_SECRET>`. This guard verifies that secret with a
 * constant-time compare.
 *
 * Fail-CLOSED when CRON_SECRET is set (these endpoints mutate data / cost
 * money). When CRON_SECRET is unset (local dev), the routes are allowed so they
 * can be exercised manually — they're harmless idempotent jobs.
 */
import { NextResponse } from "next/server";
import { timingSafeEqual } from "@/lib/timing-safe";

function extractBearer(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
  // Also accept a header for cron platforms that can't set Authorization.
  const headerSecret = request.headers.get("x-cron-secret");
  return headerSecret?.trim() || null;
}

/**
 * Returns a 401 NextResponse when the request is not an authorized cron call,
 * or null when it may proceed.
 */
export function assertCron(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null; // dev / unconfigured — allow manual runs

  const provided = extractBearer(request);
  if (!provided || !timingSafeEqual(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
