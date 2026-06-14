import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";

/**
 * CSP violation collector. The CSP ships Report-Only with `report-uri /api/csp-report`,
 * so browsers POST a report here on every violation. We log a compact line (→ journald
 * on the Vostro: `journalctl -u tez-motors | grep '\[csp\]'`) so we can confirm prod is
 * clean before flipping Content-Security-Policy-Report-Only → enforced.
 *
 * Public (browsers can't authenticate), but rate-limited + size-capped so it can't be
 * abused to flood logs. Logs only — never touches the DB.
 */
const checkRateLimit = createKvRateLimiter({ max: 60, windowMs: 60_000, prefix: "csp-report" });

export async function POST(request: NextRequest) {
  if (!(await checkRateLimit(getClientIp(request)))) return new NextResponse(null, { status: 429 });
  if (Number(request.headers.get("content-length") || 0) > 16_384) return new NextResponse(null, { status: 413 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const r = ((body?.["csp-report"] as Record<string, unknown>) || body) ?? {};
    const directive = String(r["violated-directive"] || r["effective-directive"] || "?").slice(0, 80);
    const blocked = String(r["blocked-uri"] || "?").slice(0, 200);
    const doc = String(r["document-uri"] || "?").slice(0, 200);
    console.warn(`[csp] ${directive} blocked=${blocked} on=${doc}`);
  } catch {
    // Ignore malformed/empty reports — never error on browser-sent data.
  }
  return new NextResponse(null, { status: 204 });
}
