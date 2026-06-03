import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { extractMediaFromPage, isSafeRemoteUrl, type MediaCandidate } from "@/lib/media-ingest";

/**
 * Best-effort extraction of image/video URLs from a source page (AutoHome,
 * Alibaba/AliExpress, or any page). Returns candidates for the dealer to pick;
 * re-hosting happens via /api/admin/media/ingest. Admin-only.
 *
 * Two-tier: a static HTML fetch+parse (Workers-safe, catches og/jsonld/<img> and
 * inline-script CDN URLs), PLUS an optional headless-browser renderer for fully
 * JS-rendered pages. When EXTRACTOR_URL is set (a local Playwright service — see
 * deploy/collector/extractor.mjs), the route asks it to render the page and
 * merges its candidates FIRST. Fail-open: the static parse always runs. Note the
 * extractor only works where the app can reach it (self-hosted/local — a Workers
 * edge isolate can't reach a localhost service).
 */
const schema = z.object({ url: z.string().url().max(2000) });

async function extractViaService(pageUrl: string): Promise<MediaCandidate[]> {
  const base = process.env.EXTRACTOR_URL;
  if (!base) return [];
  try {
    const secret = process.env.EXTRACTOR_SECRET;
    const res = await fetch(`${base.replace(/\/$/, "")}/extract`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(secret ? { authorization: `Bearer ${secret}` } : {}) },
      body: JSON.stringify({ url: pageUrl }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { candidates?: MediaCandidate[] };
    return (data.candidates || []).filter((c) => c?.url && isSafeRemoteUrl(c.url));
  } catch {
    return [];
  }
}

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

  // Rendered candidates (if an extractor is configured) rank first; static parse
  // is always merged so the route still works without the extractor. Dedup by URL.
  const [rendered, statics] = await Promise.all([
    extractViaService(parsed.data.url),
    extractMediaFromPage(parsed.data.url),
  ]);
  const seen = new Set<string>();
  const candidates: MediaCandidate[] = [];
  for (const c of [...rendered, ...statics]) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    candidates.push(c);
  }
  return NextResponse.json({ candidates: candidates.slice(0, 60) });
}
