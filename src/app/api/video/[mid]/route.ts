/**
 * AutoHome car-video resolver — DIRECT-SERVE, no download/storage.
 *
 * A car stores its AutoHome video media id (spec_data.video_mid). This route
 * asks AutoHome's player API for a FRESH signed mp4 url and returns it; the
 * browser's <video> then streams the bytes straight from AutoHome's CDN
 * (vc*.autohome.com.cn) — nothing is proxied or stored on our side.
 *
 * The signed url is short-lived, so we only cache the JSON briefly. mid is
 * validated as hex (no SSRF: the upstream URL is fixed, only mid is injected).
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ mid: string }> }) {
  const { mid } = await params;
  if (!/^[A-Fa-f0-9]{16,48}$/.test(mid)) {
    return NextResponse.json({ error: "bad mid" }, { status: 400 });
  }
  try {
    const r = await fetch(
      `https://p-vp.autohome.com.cn/api/gpi?mid=${mid}&ft=mp4&strategy=1`,
      { headers: { "user-agent": UA, referer: "https://v.autohome.com.cn/" }, signal: AbortSignal.timeout(8000) },
    );
    if (!r.ok) return NextResponse.json({ error: "upstream" }, { status: 502 });
    const j = await r.json();
    const media = j?.result?.media || {};
    const urls = [...(media.qualities || []), ...(media.extqualities || [])]
      .map((q: { copy?: string }) => q?.copy)
      .filter((u: unknown): u is string => typeof u === "string" && u.includes(".mp4"));
    if (!urls.length) return NextResponse.json({ error: "no video" }, { status: 404 });
    // prefer the highest resolution (the …-{height}.mp4 suffix)
    urls.sort((a, b) => (Number((b.match(/-(\d+)\.mp4/) || [])[1]) || 0) - (Number((a.match(/-(\d+)\.mp4/) || [])[1]) || 0));
    return NextResponse.json(
      { url: urls[0] },
      { headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=300" } },
    );
  } catch {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}
