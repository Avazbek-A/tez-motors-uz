import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { pingIndexNow, localeUrls } from "@/lib/seo/indexnow";

/**
 * Manual bulk IndexNow submission — pushes all available car listings + the key
 * marketing pages (×3 locales) to Bing/Yandex. New/updated cars are pinged
 * automatically on write; this is for the initial submission and manual re-pushes.
 * Admin only.
 */
const STATIC_PATHS = [
  "",
  "/catalog",
  "/used",
  "/deals",
  "/parts",
  "/scooters",
  "/about",
  "/services",
  "/contacts",
  "/faq",
  "/calculator",
  "/sell-your-car",
  "/reviews",
];

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  try {
    const supabase = createServiceClient();
    const { data: cars } = await supabase.from("cars").select("slug").eq("inventory_status", "available").limit(5000);
    const urls: string[] = [];
    for (const p of STATIC_PATHS) urls.push(...localeUrls(p));
    for (const c of cars || []) if (c.slug) urls.push(...localeUrls(`/catalog/${c.slug}`));
    const res = await pingIndexNow(urls);
    return NextResponse.json({ ok: res.ok, submitted: res.submitted, status: res.status, cars: (cars || []).length });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to submit to IndexNow" }, { status: 500 });
  }
}
