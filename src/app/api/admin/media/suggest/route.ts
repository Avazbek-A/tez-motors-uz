import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";

/**
 * Suggest CC-licensed photo candidates for a car from Wikimedia, so the dealer
 * doesn't have to hunt for a source URL. Given brand/model/(year) it searches
 * Wikipedia, then pulls the article's hero + media-list images (same approach as
 * scripts/fetch-car-images.mjs). Returns candidate URLs for the MediaImporter to
 * preview → select → re-host via the existing /api/admin/media/ingest path.
 * Admin-gated, fail-open to { candidates: [] }. Rights remain the dealer's.
 */
const UA = "tez-motors/1.0 (https://tezmotors.uz)";
const WIKI = "https://en.wikipedia.org";

const schema = z.object({
  brand: z.string().min(1).max(60),
  model: z.string().min(1).max(80),
  year: z.union([z.string(), z.number()]).optional().nullable(),
});

function isUsableImage(src: string): boolean {
  if (!src.includes("upload.wikimedia.org") || src.endsWith(".svg")) return false;
  // Match logo/icon patterns against the FILENAME only — the URL path always
  // contains "/wikipedia/commons/", which must not trip the "Wikipedia" filter.
  const file = src.split("/").pop() ?? "";
  return !/Commons-logo|Wikipedia|Question_book|Edit-clear|Ambox|Crystal_|_icon\./i.test(file);
}

async function wiki<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${WIKI}${path}`, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
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
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const { brand, model } = parsed.data;
  const query = `${brand} ${model}`.trim();

  try {
    // 1) Find the most relevant Wikipedia article.
    const search = await wiki<{ pages?: { key: string; title: string }[] }>(
      `/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=3`,
    );
    const page = search?.pages?.[0];
    if (!page) return NextResponse.json({ candidates: [], source: "wikimedia" });
    const key = page.key;

    // 2) Hero image (summary) + the article's media-list, largest src each.
    const urls: string[] = [];
    const summary = await wiki<{ originalimage?: { source?: string }; thumbnail?: { source?: string } }>(
      `/api/rest_v1/page/summary/${encodeURIComponent(key)}`,
    );
    const hero = summary?.originalimage?.source ?? summary?.thumbnail?.source;
    if (hero && isUsableImage(hero)) urls.push(hero);

    const media = await wiki<{ items?: { type: string; srcset?: { src: string; scale?: string }[] }[] }>(
      `/api/rest_v1/page/media-list/${encodeURIComponent(key)}`,
    );
    for (const it of media?.items ?? []) {
      if (it.type !== "image" || !it.srcset?.length) continue;
      const largest = it.srcset.reduce((a, c) => (parseFloat(c.scale ?? "1") > parseFloat(a.scale ?? "1") ? c : a));
      const src = largest.src.startsWith("//") ? `https:${largest.src}` : largest.src;
      if (isUsableImage(src)) urls.push(src);
    }

    // Dedupe by base filename (strip the "NNNpx-" thumbnail size prefix so the
    // same image at different resolutions collapses), cap at 12.
    const seen = new Set<string>();
    const candidates = urls
      .filter((u) => {
        const file = (u.split("/").pop() ?? u).replace(/^\d+px-/, "");
        if (seen.has(file)) return false;
        seen.add(file);
        return true;
      })
      .slice(0, 12)
      .map((url) => ({ url, type: "image" as const }));

    return NextResponse.json({ candidates, source: "wikimedia", article: page.title });
  } catch {
    return NextResponse.json({ candidates: [], source: "wikimedia" });
  }
}
