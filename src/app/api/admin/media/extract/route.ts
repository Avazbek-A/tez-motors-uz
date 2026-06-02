import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { extractMediaFromPage } from "@/lib/media-ingest";

/**
 * Best-effort extraction of image/video URLs from a source page (AutoHome,
 * Alibaba/AliExpress, or any page). Returns candidates for the dealer to pick;
 * re-hosting happens via /api/admin/media/ingest. Admin-only.
 */
const schema = z.object({ url: z.string().url().max(2000) });

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid URL is required" }, { status: 400 });
  }

  const candidates = await extractMediaFromPage(parsed.data.url);
  return NextResponse.json({ candidates });
}
