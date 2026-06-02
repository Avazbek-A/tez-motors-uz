import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { ingestImageUrl } from "@/lib/media-ingest";
import { logAdminAction } from "@/lib/audit";

/**
 * Re-host chosen image URLs to the dealer's own Storage bucket (car-images /
 * part-images). Returns a per-URL result so partial failures are visible.
 * Admin-only; rights are the dealer's responsibility.
 */
const schema = z.object({
  urls: z.array(z.string().url().max(2000)).min(1).max(12),
  bucket: z.enum(["car-images", "part-images"]),
});

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
    return NextResponse.json({ error: "urls[] (1-12) and a valid bucket are required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const results: { source: string; url?: string; error?: string }[] = [];
  for (const u of parsed.data.urls) {
    try {
      const url = await ingestImageUrl(supabase, u, { bucket: parsed.data.bucket });
      results.push({ source: u, url });
    } catch (e) {
      results.push({ source: u, error: e instanceof Error ? e.message : "failed" });
    }
  }

  logAdminAction(request, {
    action: "create",
    entity: "media",
    diff: { bucket: parsed.data.bucket, requested: parsed.data.urls.length, ingested: results.filter((r) => r.url).length },
  }).catch(() => {});

  return NextResponse.json({ results });
}
