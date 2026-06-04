import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { buildOrderDocument } from "@/lib/documents/build-for-order";
import { DOC_TYPES, type DocType, type DocLocale } from "@/lib/documents/templates";

/**
 * Paperwork engine (Phase AF) — render a branded RU/UZ business document for an
 * order as HTML (Unicode-safe, print CSS). Admin-gated. Directly printable; the
 * PDF route proxies this HTML through the extractor.
 *   GET /api/admin/orders/{id}/documents/{type}?locale=ru|uz
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> },
) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { id, type } = await params;
  if (!(DOC_TYPES as string[]).includes(type)) {
    return NextResponse.json({ error: "Unknown document type" }, { status: 400 });
  }
  const locale: DocLocale = new URL(request.url).searchParams.get("locale") === "uz" ? "uz" : "ru";

  const supabase = createServiceClient();
  const doc = await buildOrderDocument(supabase, id, type as DocType, locale);
  if (!doc) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  return new NextResponse(doc.html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // ASCII-only filename (headers are latin1; the Cyrillic title can't go here).
      "content-disposition": `inline; filename="${doc.reference}-${type}.html"`,
      "cache-control": "no-store",
    },
  });
}
