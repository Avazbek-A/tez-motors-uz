import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { googleSubmitSitemap, yandexSubmitSitemap } from "@/lib/seo/webmaster";

/**
 * Programmatic sitemap re-submission — pings Google + Yandex to (re)read
 * /sitemap.xml. Useful after a big catalog change. (Bing has no key-API sitemap
 * submit; it auto-discovers via robots.txt + gets new cars instantly via IndexNow.)
 * Admin only.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  try {
    const [google, yandex] = await Promise.all([googleSubmitSitemap(), yandexSubmitSitemap()]);
    return NextResponse.json({ ok: true, google, yandex });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to re-submit sitemap" }, { status: 500 });
  }
}
