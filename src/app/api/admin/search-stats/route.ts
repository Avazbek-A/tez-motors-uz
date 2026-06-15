import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { bingStats, yandexStats } from "@/lib/seo/webmaster";

/**
 * Search-engine indexing health (Bing + Yandex Webmaster APIs) for the Engine Ops
 * panel. Read-only, admin. Fail-soft per engine (a missing cred just shows
 * "not configured"). Google has no comparable public API — use Search Console.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  try {
    const [bing, yandex] = await Promise.all([bingStats(), yandexStats()]);
    return NextResponse.json({ ok: true, bing, yandex });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to fetch search stats" }, { status: 500 });
  }
}
