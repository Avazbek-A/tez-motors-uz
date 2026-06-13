"use client";

import { useEffect, useState } from "react";

/**
 * AutoHome car-overview video, streamed DIRECT from AutoHome's CDN (no download).
 * Resolves a fresh signed mp4 url via /api/video/{mid}, then plays it in our own
 * <video> — clean player, no AutoHome page chrome. Renders nothing if it fails.
 */
export function CarVideo({ mid, poster }: { mid: string; poster?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/video/${mid}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (alive && d?.url) setUrl(d.url); else if (alive) setFailed(true); })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [mid]);

  if (failed) return null;

  return (
    <video
      src={url ?? undefined}
      poster={poster}
      controls
      preload="none"
      playsInline
      className="w-full h-full bg-black"
    />
  );
}
