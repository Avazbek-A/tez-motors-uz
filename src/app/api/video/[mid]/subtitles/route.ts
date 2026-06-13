/**
 * Serve a WebVTT subtitle track for an AutoHome overview clip.
 *
 * Subtitles are generated offline (local Whisper STT of the Chinese narration →
 * RU/UZ translation) and stored in the owning car's `spec_data.subtitles[lang]`.
 * Only clips with real speech have them (music-only b-roll does not). The player
 * attaches this as a same-origin <track src> so it stays inside CSP `'self'`.
 *
 * mid is validated as hex (no injection: it's only used as a filter value).
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const LANGS = new Set(["ru", "uz", "en"]);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ mid: string }> }) {
  const { mid } = await params;
  const url = new URL(_req.url);
  const lang = (url.searchParams.get("lang") || "ru").toLowerCase();

  if (!/^[A-Fa-f0-9]{16,48}$/.test(mid) || !LANGS.has(lang)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("cars")
      .select("spec_data")
      .filter("spec_data->>video_mid", "eq", mid)
      .limit(1)
      .maybeSingle();

    const vtt = (data?.spec_data as { subtitles?: Record<string, string> } | null)?.subtitles?.[lang];
    if (error || typeof vtt !== "string" || !vtt.startsWith("WEBVTT")) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    return new NextResponse(vtt, {
      headers: {
        "content-type": "text/vtt; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "error" }, { status: 500 });
  }
}
