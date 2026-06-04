import { createClient } from "@/lib/supabase/server";
import { SITE_CONFIG } from "@/lib/constants";

/**
 * Beautiful spec-sheet PDF. When the car has imported spec_data AND a Playwright
 * extractor is configured (EXTRACTOR_URL — the Vostro), render the public spec
 * page (print CSS) to a styled A4 PDF. Otherwise fall back to the always-works
 * raw-text PDF at /api/cars/[id]/pdf (edge-safe). Fail-open: any extractor error
 * → the raw-text fallback. `?trims=` / `?sections=` / `?locale=` pass through.
 *
 * Security: the origin we hand the extractor MUST come from a server-pinned URL
 * (NEXT_PUBLIC_SITE_URL / SITE_CONFIG.url), NOT request.url's host. Otherwise an
 * attacker with `Host: attacker.com` would have Chromium render attacker.com and
 * return that as a "Tez Motors spec sheet" PDF (phishing + SSRF vector). The
 * extractor is on a trusted box; we never want to point it at user-supplied
 * origins. `id` is validated as a UUID before any interpolation, and the
 * pass-through query params are length/charset clamped.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_QS = /^[A-Za-z0-9_,\-]{1,200}$/; // trims/sections: comma-separated slugs only
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || SITE_CONFIG.url).replace(/\/$/, "");

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Invalid id" }, { status: 400 });
  const url = new URL(request.url);
  const fallback = () => Response.redirect(`${SITE_URL}/api/cars/${id}/pdf`, 307);

  type CarRow = { slug: string; spec_data: unknown };
  let car: CarRow | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("cars").select("slug, spec_data").eq("id", id).maybeSingle();
    car = (data as CarRow | null) ?? null;
  } catch {
    return fallback();
  }
  if (!car) return Response.json({ error: "Car not found" }, { status: 404 });

  const spec = car.spec_data as { trims?: unknown[] } | null;
  const hasSpec = !!(spec && Array.isArray(spec.trims) && spec.trims.length > 0);
  const extractor = process.env.EXTRACTOR_URL;
  if (!hasSpec || !extractor) return fallback();

  const rawLocale = url.searchParams.get("locale") || "";
  const locale = (["ru", "uz", "en"] as const).includes(rawLocale as "ru" | "uz" | "en") ? rawLocale : "ru";
  const qs = new URLSearchParams({ print: "1" });
  for (const k of ["trims", "sections"] as const) {
    const v = url.searchParams.get(k);
    if (v && SAFE_QS.test(v)) qs.set(k, v); // silently drop invalid/oversized inputs
  }
  const specUrl = `${SITE_URL}/${locale}/catalog/${encodeURIComponent(car.slug)}/spec?${qs.toString()}`;

  try {
    const secret = process.env.EXTRACTOR_SECRET;
    const res = await fetch(`${extractor.replace(/\/$/, "")}/render-pdf`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(secret ? { authorization: `Bearer ${secret}` } : {}) },
      body: JSON.stringify({ url: specUrl }),
      signal: AbortSignal.timeout(45_000),
    });
    if (res.ok && (res.headers.get("content-type") || "").includes("pdf")) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 800) {
        return new Response(buf, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="tez-motors-${car.slug}-spec.pdf"`,
            "Cache-Control": "no-store",
          },
        });
      }
    }
  } catch {
    // fall through to the raw-text fallback
  }
  return fallback();
}
