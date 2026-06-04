import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { buildOrderDocument } from "@/lib/documents/build-for-order";
import { DOC_TYPES, type DocType, type DocLocale } from "@/lib/documents/templates";

/**
 * Paperwork engine (Phase AF) — PDF of an order document via the Vostro extractor
 * /render-pdf (passing the HTML, since the extractor can't authenticate to fetch
 * the admin-gated doc). Fail-open: when EXTRACTOR_URL is unset or render fails,
 * 307-redirect to the printable HTML doc (browser print-to-PDF still works).
 *   POST { orderId, type, locale }
 */
const schema = z.object({
  orderId: z.string().uuid(),
  type: z.enum(DOC_TYPES as [DocType, ...DocType[]]),
  locale: z.enum(["ru", "uz"]).optional(),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const locale: DocLocale = parsed.data.locale === "uz" ? "uz" : "ru";
  const supabase = createServiceClient();
  const doc = await buildOrderDocument(supabase, parsed.data.orderId, parsed.data.type, locale);
  if (!doc) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const base = process.env.EXTRACTOR_URL;
  const fallbackUrl = `/api/admin/orders/${parsed.data.orderId}/documents/${parsed.data.type}?locale=${locale}`;
  if (!base) return NextResponse.redirect(new URL(fallbackUrl, request.url), 307);

  try {
    const secret = process.env.EXTRACTOR_SECRET;
    const res = await fetch(`${base.replace(/\/$/, "")}/render-pdf`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(secret ? { authorization: `Bearer ${secret}` } : {}) },
      body: JSON.stringify({ html: doc.html }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return NextResponse.redirect(new URL(fallbackUrl, request.url), 307);
    const pdf = await res.arrayBuffer();
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        // ASCII-only filename (Cyrillic title can't go in a latin1 header).
        "content-disposition": `attachment; filename="${doc.reference}-${parsed.data.type}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.redirect(new URL(fallbackUrl, request.url), 307);
  }
}
