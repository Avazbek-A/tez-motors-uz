import { createClient } from "@/lib/supabase/server";

/**
 * Beautiful spec-sheet PDF. When the car has imported spec_data AND a Playwright
 * extractor is configured (EXTRACTOR_URL — the Vostro), render the public spec
 * page (print CSS) to a styled A4 PDF. Otherwise fall back to the always-works
 * raw-text PDF at /api/cars/[id]/pdf (edge-safe). Fail-open: any extractor error
 * → the raw-text fallback. `?trims=` / `?sections=` / `?locale=` pass through.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const origin = url.origin;
  const fallback = () => Response.redirect(`${origin}/api/cars/${id}/pdf`, 307);

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

  const locale = (["ru", "uz", "en"].includes(url.searchParams.get("locale") || "") ? url.searchParams.get("locale") : "ru") as string;
  const qs = new URLSearchParams({ print: "1" });
  for (const k of ["trims", "sections"]) {
    const v = url.searchParams.get(k);
    if (v) qs.set(k, v);
  }
  const specUrl = `${origin}/${locale}/catalog/${encodeURIComponent(car.slug)}/spec?${qs.toString()}`;

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
