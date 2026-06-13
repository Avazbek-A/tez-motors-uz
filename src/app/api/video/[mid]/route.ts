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
    // AutoHome quality codes -> clean labels (流畅/标清/高清/1080P/4K)
    const LABEL: Record<number, string> = { 100: "360p", 200: "480p", 300: "720p", 400: "1080p", 500: "4K" };
    const variants = (media.qualities || [])
      .map((q: { value?: number; desc?: string; copy?: string }) => ({
        value: Number(q?.value) || 0,
        label: LABEL[Number(q?.value)] || String(q?.desc || ""),
        url: q?.copy,
      }))
      .filter((v: { url?: unknown }): v is { value: number; label: string; url: string } => typeof v.url === "string" && v.url.includes(".mp4"))
      .sort((a: { value: number }, b: { value: number }) => b.value - a.value); // high → low
    if (!variants.length) return NextResponse.json({ error: "no video" }, { status: 404 });
    return NextResponse.json(
      { variants, url: variants[0].url },
      { headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=300" } },
    );
  } catch {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}
